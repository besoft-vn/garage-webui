package router

import (
	"fmt"
	"khairul169/garage-webui/utils"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
)

func ProxyHandler(w http.ResponseWriter, r *http.Request) {
	target, err := url.Parse(utils.Garage.GetAdminEndpoint())
	if err != nil {
		utils.ResponseError(w, err)
		return
	}

	// Bucket keys, permissions or aliases may change, so drop the cached
	// S3 credentials used by the browser and lifecycle endpoints.
	if r.Method != http.MethodGet {
		utils.Cache.DeletePrefix(bucketCredentialsCachePrefix)
	}

	proxy := &httputil.ReverseProxy{
		Rewrite: func(r *httputil.ProxyRequest) {
			r.SetURL(target)
			r.Out.URL.Path = strings.TrimPrefix(r.In.URL.Path, "/api")
			r.Out.Header.Set("Authorization", fmt.Sprintf("Bearer %s", utils.Garage.GetAdminKey()))
		},
	}

	proxy.ServeHTTP(w, r)
}
