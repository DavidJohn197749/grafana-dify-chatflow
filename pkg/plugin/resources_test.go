package plugin

import (
	"bytes"
	"context"
	"encoding/json"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// mockCallResourceResponseSender implements backend.CallResourceResponseSender
// for use in tests.
type mockCallResourceResponseSender struct {
	response *backend.CallResourceResponse
}

// Send sets the received *backend.CallResourceResponse to s.response
func (s *mockCallResourceResponseSender) Send(response *backend.CallResourceResponse) error {
	s.response = response
	return nil
}

// TestCallResource tests CallResource calls, using backend.CallResourceRequest and backend.CallResourceResponse.
// This ensures the httpadapter for CallResource works correctly.
func TestCallResource(t *testing.T) {
	// Initialize app
	inst, err := NewApp(context.Background(), backend.AppInstanceSettings{})
	if err != nil {
		t.Fatalf("new app: %s", err)
	}
	if inst == nil {
		t.Fatal("inst must not be nil")
	}
	app, ok := inst.(*App)
	if !ok {
		t.Fatal("inst must be of type *App")
	}

	// Set up and run test cases
	for _, tc := range []struct {
		name string

		method string
		path   string
		body   []byte

		expStatus int
		expBody   []byte
	}{
		{
			name:      "get ping 200",
			method:    http.MethodGet,
			path:      "ping",
			expStatus: http.StatusOK,
		},
		{
			name:      "get echo 405",
			method:    http.MethodGet,
			path:      "echo",
			expStatus: http.StatusMethodNotAllowed,
		},
		{
			name:      "post echo 200",
			method:    http.MethodPost,
			path:      "echo",
			body:      []byte(`{"message":"ok"}`),
			expStatus: http.StatusOK,
			expBody:   []byte(`{"message":"ok"}`),
		},
		{
			name:      "get non existing handler 404",
			method:    http.MethodGet,
			path:      "not_found",
			expStatus: http.StatusNotFound,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			// Request by calling CallResource. This tests the httpadapter.
			var r mockCallResourceResponseSender
			err = app.CallResource(context.Background(), &backend.CallResourceRequest{
				Method: tc.method,
				Path:   tc.path,
				Body:   tc.body,
			}, &r)
			if err != nil {
				t.Fatalf("CallResource error: %s", err)
			}
			if r.response == nil {
				t.Fatal("no response received from CallResource")
			}
			if tc.expStatus > 0 && tc.expStatus != r.response.Status {
				t.Errorf("response status should be %d, got %d", tc.expStatus, r.response.Status)
			}
			if len(tc.expBody) > 0 {
				if tb := bytes.TrimSpace(r.response.Body); !bytes.Equal(tb, tc.expBody) {
					t.Errorf("response body should be %s, got %s", tc.expBody, tb)
				}
			}
		})
	}
}

// TestCallDifyWorkflowAPI tests the callDifyWorkflowAPI function
func TestCallDifyWorkflowAPI(t *testing.T) {
	// Test cases
	testCases := []struct {
		name           string
		apiUrl         string
		apiKey         string
		inputs         interface{}
		mockResponse   string
		mockStatusCode int
		expectError    bool
		expectedURL    string
	}{
		{
			name:           "successful API call",
			apiUrl:         "https://api.dify.ai",
			apiKey:         "app-BY4mKffjRdOJemnxqX4d7ThY",
			inputs:         map[string]interface{}{"inputs": map[string]interface{}{"query": "test query"}},
			mockResponse:   `{"result": "success"}`,
			mockStatusCode: 200,
			expectError:    false,
			expectedURL:    "/v1/workflows/run",
		},
		{
			name:           "API returns error",
			apiUrl:         "https://api.dify.ai",
			apiKey:         "app-BY4mKffjRdOJemnxqX4d7ThY",
			inputs:         map[string]interface{}{"inputs": map[string]interface{}{"query": "test query"}},
			mockResponse:   `{"error": "invalid request"}`,
			mockStatusCode: 400,
			expectError:    false, // Function should not return error for HTTP 400, just return the response
			expectedURL:    "/v1/workflows/run",
		},
		{
			name:           "empty request body",
			apiUrl:         "https://api.dify.ai",
			apiKey:         "app-BY4mKffjRdOJemnxqX4d7ThY",
			inputs:         map[string]interface{}{},
			mockResponse:   `{"result": "success"}`,
			mockStatusCode: 200,
			expectError:    false,
			expectedURL:    "/v1/workflows/run",
		},
		{
			name:           "request with custom fields",
			apiUrl:         "https://api.dify.ai",
			apiKey:         "app-BY4mKffjRdOJemnxqX4d7ThY",
			inputs:         map[string]interface{}{"custom_field": "value", "another_field": 123},
			mockResponse:   `{"result": "success"}`,
			mockStatusCode: 200,
			expectError:    false,
			expectedURL:    "/v1/workflows/run",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create a mock server
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// Verify the request method
				if r.Method != "POST" {
					t.Errorf("Expected POST method, got %s", r.Method)
				}

				// Verify the URL path
				expectedPath := tc.expectedURL
				if r.URL.Path != expectedPath {
					t.Errorf("Expected path %s, got %s", expectedPath, r.URL.Path)
				}

				// Verify the Authorization header
				expectedAuth := "Bearer " + tc.apiKey
				if r.Header.Get("Authorization") != expectedAuth {
					t.Errorf("Expected Authorization header %s, got %s", expectedAuth, r.Header.Get("Authorization"))
				}

				// Verify the Content-Type header
				if r.Header.Get("Content-Type") != "application/json" {
					t.Errorf("Expected Content-Type application/json, got %s", r.Header.Get("Content-Type"))
				}

				// Parse and verify the request body
				var requestBody map[string]interface{}
				if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
					t.Errorf("Failed to decode request body: %v", err)
				}

				// Verify that the request body matches what was sent
				// The entire request body should be passed through as-is
				if len(requestBody) == 0 {
					t.Error("Expected non-empty request body")
				}

				// Set response
				w.WriteHeader(tc.mockStatusCode)
				w.Write([]byte(tc.mockResponse))
			}))
			defer server.Close()

			// Call the function
			resp, err := callDifyWorkflowAPI(server.URL, tc.apiKey, tc.inputs)

			// Check for errors
			if tc.expectError {
				if err == nil {
					t.Error("Expected error but got none")
				}
				return
			}

			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}

			// Verify response
			if resp == nil {
				t.Error("Expected response but got nil")
				return
			}

			if resp.StatusCode != tc.mockStatusCode {
				t.Errorf("Expected status code %d, got %d", tc.mockStatusCode, resp.StatusCode)
			}

			// Read and verify response body
			buf := make([]byte, 1024)
			n, err := resp.Body.Read(buf)
			if err != nil && err.Error() != "EOF" {
				t.Errorf("Failed to read response body: %v", err)
			}

			responseBody := string(buf[:n])
			if !strings.Contains(responseBody, tc.mockResponse) {
				t.Errorf("Expected response body to contain %s, got %s", tc.mockResponse, responseBody)
			}
		})
	}
}

// TestCallDifyWorkflowAPIErrorHandling tests error handling in callDifyWorkflowAPI
func TestCallDifyWorkflowAPIErrorHandling(t *testing.T) {
	testCases := []struct {
		name        string
		apiUrl      string
		apiKey      string
		inputs      interface{}
		expectError bool
	}{
		{
			name:        "invalid JSON marshaling",
			apiUrl:      "https://api.dify.ai",
			apiKey:      "app-BY4mKffjRdOJemnxqX4d7ThY",
			inputs:      make(chan int), // This will cause JSON marshaling to fail
			expectError: true,
		},
		{
			name:        "invalid URL",
			apiUrl:      "://invalid-url",
			apiKey:      "app-BY4mKffjRdOJemnxqX4d7ThY",
			inputs:      map[string]interface{}{"query": "test"},
			expectError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			resp, err := callDifyWorkflowAPI(tc.apiUrl, tc.apiKey, tc.inputs)

			if tc.expectError {
				if err == nil {
					t.Error("Expected error but got none")
				}
				if resp != nil {
					t.Error("Expected nil response when error occurs")
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
				if resp == nil {
					t.Error("Expected response but got nil")
				}
			}
		})
	}
}

// TestHandleDifyWorkflowProxyBodyValidation tests body validation in handleDifyWorkflowProxy
func TestHandleDifyWorkflowProxyBodyValidation(t *testing.T) {
	// Initialize app with test configuration
	jsonData := []byte(`{"apiUrl": "https://api.dify.ai"}`)
	secureJsonData := map[string]string{"apiKey": "test-api-key"}

	inst, err := NewApp(context.Background(), backend.AppInstanceSettings{
		JSONData:                jsonData,
		DecryptedSecureJSONData: secureJsonData,
	})
	if err != nil {
		t.Fatalf("new app: %s", err)
	}
	app, ok := inst.(*App)
	if !ok {
		t.Fatal("inst must be of type *App")
	}

	testCases := []struct {
		name           string
		method         string
		body           []byte
		contentLength  int64
		expectedStatus int
		expectedError  string
	}{
		{
			name:           "valid request with inputs",
			method:         http.MethodPost,
			body:           []byte(`{"inputs": {"query": "test query"}}`),
			expectedStatus: http.StatusOK,
		},
		{
			name:           "missing request body",
			method:         http.MethodPost,
			body:           nil,
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Request body is required",
		},
		{
			name:           "empty request body",
			method:         http.MethodPost,
			body:           []byte(``),
			expectedStatus: http.StatusOK, // Now accepts empty body and defaults to {}
		},
		{
			name:           "empty JSON object",
			method:         http.MethodPost,
			body:           []byte(`{}`),
			expectedStatus: http.StatusOK, // Empty JSON object is valid
		},
		{
			name:           "invalid JSON",
			method:         http.MethodPost,
			body:           []byte(`{"invalid": json}`),
			expectedStatus: http.StatusBadRequest,
			expectedError:  "Invalid JSON in request body",
		},
		{
			name:           "request with other fields",
			method:         http.MethodPost,
			body:           []byte(`{"other_field": "value"}`),
			expectedStatus: http.StatusOK, // Now accepts any valid JSON body
		},
		{
			name:           "request with null field",
			method:         http.MethodPost,
			body:           []byte(`{"inputs": null}`),
			expectedStatus: http.StatusOK, // Now accepts any valid JSON body
		},
		{
			name:           "empty inputs object",
			method:         http.MethodPost,
			body:           []byte(`{"inputs": {}}`),
			expectedStatus: http.StatusOK, // Empty object is valid
		},
		{
			name:           "request too large",
			method:         http.MethodPost,
			body:           []byte(`{"inputs": {"query": "test"}}`),
			contentLength:  11 * 1024 * 1024, // 11MB, exceeds 10MB limit
			expectedStatus: http.StatusRequestEntityTooLarge,
			expectedError:  "Request body too large",
		},
		{
			name:           "GET request with empty inputs",
			method:         http.MethodGet,
			body:           nil,
			expectedStatus: http.StatusOK, // GET requests now supported with empty inputs
		},
		{
			name:           "PUT request with empty inputs",
			method:         http.MethodPut,
			body:           nil,
			expectedStatus: http.StatusOK, // PUT requests now supported with empty inputs
		},
		{
			name:           "DELETE request with empty inputs",
			method:         http.MethodDelete,
			body:           nil,
			expectedStatus: http.StatusOK, // DELETE requests now supported with empty inputs
		},
		{
			name:           "PATCH request with body",
			method:         http.MethodPatch,
			body:           []byte(`{"inputs": {"query": "test"}}`),
			expectedStatus: http.StatusOK, // PATCH requests now supported
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create request
			var bodyReader *bytes.Reader
			if tc.body != nil {
				bodyReader = bytes.NewReader(tc.body)
			}

			req := httptest.NewRequest(tc.method, "/difyWorkflowProxy", bodyReader)
			if tc.contentLength > 0 {
				req.ContentLength = tc.contentLength
			}

			// Add plugin context
			ctx := backend.WithPluginConfig(req.Context(), backend.PluginConfig{
				AppInstanceSettings: backend.AppInstanceSettings{
					JSONData:                jsonData,
					DecryptedSecureJSONData: secureJsonData,
				},
			})
			req = req.WithContext(ctx)

			// Create response recorder
			w := httptest.NewRecorder()

			// Call the handler
			app.handleDifyWorkflowProxy(w, req)

			// Check status code
			if w.Code != tc.expectedStatus {
				t.Errorf("Expected status %d, got %d", tc.expectedStatus, w.Code)
			}

			// Check error message if expected
			if tc.expectedError != "" {
				body := w.Body.String()
				if !strings.Contains(body, tc.expectedError) {
					t.Errorf("Expected error message to contain '%s', got '%s'", tc.expectedError, body)
				}
			}
		})
	}
}
