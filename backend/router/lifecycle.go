package router

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"khairul169/garage-webui/schema"
	"khairul169/garage-webui/utils"
	"net/http"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/smithy-go"
)

type Lifecycle struct{}

func (l *Lifecycle) GetRules(w http.ResponseWriter, r *http.Request) {
	bucket := r.PathValue("bucket")

	client, err := getS3Client(bucket)
	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	result := schema.LifecycleConfig{Rules: []schema.LifecycleRule{}}

	res, err := client.GetBucketLifecycleConfiguration(context.Background(), &s3.GetBucketLifecycleConfigurationInput{
		Bucket: aws.String(bucket),
	})
	if err != nil {
		var ae smithy.APIError
		if errors.As(err, &ae) && ae.ErrorCode() == "NoSuchLifecycleConfiguration" {
			utils.ResponseSuccess(w, result)
			return
		}
		utils.ResponseError(w, lifecycleError(err))
		return
	}

	for _, rule := range res.Rules {
		result.Rules = append(result.Rules, fromS3LifecycleRule(rule))
	}

	utils.ResponseSuccess(w, result)
}

func (l *Lifecycle) PutRules(w http.ResponseWriter, r *http.Request) {
	bucket := r.PathValue("bucket")

	var body schema.LifecycleConfig
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		utils.ResponseErrorStatus(w, err, http.StatusBadRequest)
		return
	}

	rules := make([]types.LifecycleRule, 0, len(body.Rules))
	for idx, rule := range body.Rules {
		s3Rule, err := toS3LifecycleRule(rule)
		if err != nil {
			utils.ResponseErrorStatus(w, fmt.Errorf("rule #%d: %w", idx+1, err), http.StatusBadRequest)
			return
		}
		rules = append(rules, s3Rule)
	}

	client, err := getS3Client(bucket)
	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	// An empty rule set removes the lifecycle configuration entirely
	if len(rules) == 0 {
		_, err := client.DeleteBucketLifecycle(context.Background(), &s3.DeleteBucketLifecycleInput{
			Bucket: aws.String(bucket),
		})
		if err != nil {
			utils.ResponseError(w, lifecycleError(err))
			return
		}
		utils.ResponseSuccess(w, true)
		return
	}

	_, err = client.PutBucketLifecycleConfiguration(context.Background(), &s3.PutBucketLifecycleConfigurationInput{
		Bucket:                 aws.String(bucket),
		LifecycleConfiguration: &types.BucketLifecycleConfiguration{Rules: rules},
	})
	if err != nil {
		utils.ResponseError(w, lifecycleError(err))
		return
	}

	utils.ResponseSuccess(w, true)
}

func lifecycleError(err error) error {
	var ae smithy.APIError
	if errors.As(err, &ae) && ae.ErrorCode() == "AccessDenied" {
		return fmt.Errorf("access denied: managing lifecycle rules requires a key with read, write and owner permissions on this bucket")
	}
	return err
}

func toS3LifecycleRule(rule schema.LifecycleRule) (types.LifecycleRule, error) {
	res := types.LifecycleRule{
		Status: types.ExpirationStatusDisabled,
	}

	if rule.Enabled {
		res.Status = types.ExpirationStatusEnabled
	}
	if id := strings.TrimSpace(rule.ID); id != "" {
		res.ID = aws.String(id)
	}

	// Filter: Garage accepts a single condition, or several wrapped in <And>
	var filters []types.LifecycleRuleFilter
	and := &types.LifecycleRuleAndOperator{}

	if rule.Prefix != "" {
		filters = append(filters, &types.LifecycleRuleFilterMemberPrefix{Value: rule.Prefix})
		and.Prefix = aws.String(rule.Prefix)
	}
	if rule.ObjectSizeGreaterThan != nil {
		if *rule.ObjectSizeGreaterThan < 0 {
			return res, errors.New("minimum object size must not be negative")
		}
		filters = append(filters, &types.LifecycleRuleFilterMemberObjectSizeGreaterThan{Value: *rule.ObjectSizeGreaterThan})
		and.ObjectSizeGreaterThan = rule.ObjectSizeGreaterThan
	}
	if rule.ObjectSizeLessThan != nil {
		if *rule.ObjectSizeLessThan <= 0 {
			return res, errors.New("maximum object size must be greater than zero")
		}
		filters = append(filters, &types.LifecycleRuleFilterMemberObjectSizeLessThan{Value: *rule.ObjectSizeLessThan})
		and.ObjectSizeLessThan = rule.ObjectSizeLessThan
	}

	switch len(filters) {
	case 0:
		res.Filter = &types.LifecycleRuleFilterMemberPrefix{Value: ""}
	case 1:
		res.Filter = filters[0]
	default:
		res.Filter = &types.LifecycleRuleFilterMemberAnd{Value: *and}
	}

	// Actions
	if rule.ExpirationDays != nil && rule.ExpirationDate != "" {
		return res, errors.New("expiration must be set either by days or by date, not both")
	}
	if rule.ExpirationDays != nil {
		if *rule.ExpirationDays <= 0 {
			return res, errors.New("expiration days must be greater than zero")
		}
		res.Expiration = &types.LifecycleExpiration{Days: rule.ExpirationDays}
	}
	if rule.ExpirationDate != "" {
		date, err := time.Parse("2006-01-02", rule.ExpirationDate)
		if err != nil {
			return res, fmt.Errorf("invalid expiration date: %w", err)
		}
		res.Expiration = &types.LifecycleExpiration{Date: aws.Time(date.UTC())}
	}
	if rule.AbortIncompleteUploadsDays != nil {
		if *rule.AbortIncompleteUploadsDays <= 0 {
			return res, errors.New("abort incomplete uploads days must be greater than zero")
		}
		res.AbortIncompleteMultipartUpload = &types.AbortIncompleteMultipartUpload{
			DaysAfterInitiation: rule.AbortIncompleteUploadsDays,
		}
	}

	if res.Expiration == nil && res.AbortIncompleteMultipartUpload == nil {
		return res, errors.New("at least one action (expiration or abort incomplete uploads) is required")
	}

	return res, nil
}

func fromS3LifecycleRule(rule types.LifecycleRule) schema.LifecycleRule {
	res := schema.LifecycleRule{
		ID:      aws.ToString(rule.ID),
		Enabled: rule.Status == types.ExpirationStatusEnabled,
		Prefix:  aws.ToString(rule.Prefix),
	}

	switch f := rule.Filter.(type) {
	case *types.LifecycleRuleFilterMemberPrefix:
		res.Prefix = f.Value
	case *types.LifecycleRuleFilterMemberObjectSizeGreaterThan:
		res.ObjectSizeGreaterThan = aws.Int64(f.Value)
	case *types.LifecycleRuleFilterMemberObjectSizeLessThan:
		res.ObjectSizeLessThan = aws.Int64(f.Value)
	case *types.LifecycleRuleFilterMemberAnd:
		res.Prefix = aws.ToString(f.Value.Prefix)
		res.ObjectSizeGreaterThan = f.Value.ObjectSizeGreaterThan
		res.ObjectSizeLessThan = f.Value.ObjectSizeLessThan
	}

	if rule.Expiration != nil {
		res.ExpirationDays = rule.Expiration.Days
		if rule.Expiration.Date != nil {
			res.ExpirationDate = rule.Expiration.Date.UTC().Format("2006-01-02")
		}
	}
	if rule.AbortIncompleteMultipartUpload != nil {
		res.AbortIncompleteUploadsDays = rule.AbortIncompleteMultipartUpload.DaysAfterInitiation
	}

	return res
}
