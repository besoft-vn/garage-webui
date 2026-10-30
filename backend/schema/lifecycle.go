package schema

type LifecycleRule struct {
	ID                         string `json:"id"`
	Enabled                    bool   `json:"enabled"`
	Prefix                     string `json:"prefix"`
	ObjectSizeGreaterThan      *int64 `json:"objectSizeGreaterThan"`
	ObjectSizeLessThan         *int64 `json:"objectSizeLessThan"`
	ExpirationDays             *int32 `json:"expirationDays"`
	ExpirationDate             string `json:"expirationDate"`
	AbortIncompleteUploadsDays *int32 `json:"abortIncompleteUploadsDays"`
}

type LifecycleConfig struct {
	Rules []LifecycleRule `json:"rules"`
}
