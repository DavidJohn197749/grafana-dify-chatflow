package plugin

import (
	"io"
	"bytes"
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

// handlePing is an example HTTP GET resource that returns a {"message": "ok"} JSON response.
func (a *App) handlePing(w http.ResponseWriter, req *http.Request) {
	w.Header().Add("Content-Type", "application/json")
	if _, err := w.Write([]byte(`{"message": "ok"}`)); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// handleEcho is an example HTTP POST resource that accepts a JSON with a "message" key and
// returns to the client whatever it is sent.
func (a *App) handleEcho(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Message string `json:"message"`
	}
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Add("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(body); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (a *App) handleDifyWorkflow(w http.ResponseWriter, req *http.Request) {
	pluginConfig := backend.PluginConfigFromContext(req.Context())
	jsonData := pluginConfig.AppInstanceSettings.JSONData
	secureJsonData := pluginConfig.AppInstanceSettings.DecryptedSecureJSONData
	log.DefaultLogger.Debug("secureJsonData content", "data", secureJsonData)
	log.DefaultLogger.Debug("jsonData content", "data", jsonData)
	log.DefaultLogger.Debug("Goto SLS with STS success.")

	var config map[string]interface{}
	if err := json.Unmarshal(jsonData, &config); err != nil {
		http.Error(w, "Invalid JSONData", http.StatusInternalServerError)
		return
	}
	apiUrl, ok := config["apiUrl"].(string)
	if !ok {
		http.Error(w, "apiUrl not found or not a string", http.StatusBadRequest)
		return
	}

	apiKey, ok := secureJsonData["apiKey"]
	if !ok {
		http.Error(w, "API key is not set", http.StatusBadRequest)
		return
	} else {

		response := map[string]string{
			"apiKey": apiKey,
			"apiUrl": apiUrl,
		}
		w.Header().Add("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(response); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}
	w.WriteHeader(http.StatusOK)
}

// callDifyWorkflowAPI makes a request to the Dify workflow API
func callDifyWorkflowAPI(apiUrl, apiKey string, inputs interface{}) (*http.Response, error) {
	// Create the Dify API URL
	difyURL := apiUrl + "/v1/workflows/run"

	// Create the request payload with hardcoded values and provided inputs
	payload := map[string]interface{}{
		"inputs":        inputs,         // Use provided inputs
		"response_mode": "streaming",    // Hardcoded
		"user":          "grafana-user", // Hardcoded
	}

	// Marshal the payload to JSON
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		log.DefaultLogger.Error("Failed to marshal payload", "error", err)
		return nil, err
	}

	// Debug log: Print request details
	log.DefaultLogger.Debug("Making request to Dify API",
		"url", difyURL,
		"payload", string(payloadBytes),
		"inputs", inputs)

	// Create a new HTTP request to Dify API
	req, err := http.NewRequest("POST", difyURL, bytes.NewBuffer(payloadBytes))
	if err != nil {
		log.DefaultLogger.Error("Failed to create HTTP request", "error", err)
		return nil, err
	}

	// Set headers
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	// Make the request to Dify API
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.DefaultLogger.Error("Failed to make request to Dify API", "error", err, "url", difyURL)
		return nil, err
	}

	// Debug log: Print response details
	log.DefaultLogger.Debug("Received response from Dify API",
		"status_code", resp.StatusCode,
		"status", resp.Status,
		"url", difyURL)

	return resp, nil
}

// handleDifyWorkflowProxy proxies requests to the Dify workflow API
func (a *App) handleDifyWorkflowProxy(w http.ResponseWriter, req *http.Request) {
	// Allow all HTTP methods

	// Debug log: Print incoming request details
	log.DefaultLogger.Debug("Received request to difyWorkflowProxy",
		"method", req.Method,
		"url", req.URL.String(),
		"content_length", req.ContentLength,
		"has_body", req.Body != nil)

	// Get plugin configuration
	pluginConfig := backend.PluginConfigFromContext(req.Context())
	jsonData := pluginConfig.AppInstanceSettings.JSONData
	secureJsonData := pluginConfig.AppInstanceSettings.DecryptedSecureJSONData

	// Parse configuration
	var config map[string]interface{}
	if err := json.Unmarshal(jsonData, &config); err != nil {
		http.Error(w, "Invalid JSONData", http.StatusInternalServerError)
		return
	}

	// Get API URL from configuration
	apiUrl, ok := config["apiUrl"].(string)
	if !ok {
		http.Error(w, "apiUrl not found or not a string", http.StatusBadRequest)
		return
	}

	// Get API key from secure configuration
	apiKey, ok := secureJsonData["apiKey"]
	if !ok {
		http.Error(w, "API key is not set", http.StatusBadRequest)
		return
	}

	var inputs map[string]interface{}

	// Handle request body - if no body or empty body, use empty object as default
	if req.Body == nil || req.ContentLength == 0 {
		// No body provided, use empty object as default
		inputs = map[string]interface{}{}
	} else {
		// Check content length to prevent oversized requests (max 10MB)
		if req.ContentLength > 10*1024*1024 {
			http.Error(w, "Request body too large (max 10MB)", http.StatusRequestEntityTooLarge)
			return
		}

		// Parse the incoming request body to extract inputs
		var requestBody map[string]interface{}
		if err := json.NewDecoder(req.Body).Decode(&requestBody); err != nil {
			http.Error(w, "Invalid JSON in request body: "+err.Error(), http.StatusBadRequest)
			return
		}

		// If body is empty, use empty object as default
		inputs = requestBody
		if len(requestBody) == 0 {
			inputs = map[string]interface{}{}
		}
	}

	// Debug log: Print final inputs being sent to Dify
	log.DefaultLogger.Debug("Sending inputs to Dify API",
		"inputs", inputs,
		"api_url", apiUrl)

	// Use the abstracted function to call Dify API
	resp, err := callDifyWorkflowAPI(apiUrl, apiKey, inputs)
	if err != nil {
		http.Error(w, "Failed to call Dify API: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	// Copy response headers
	for key, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}

	// Set status code
	w.WriteHeader(resp.StatusCode)

	// Stream the response body
	buf := make([]byte, 32*1024) // 32KB buffer
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			if _, writeErr := w.Write(buf[:n]); writeErr != nil {
				break
			}
		}
		if err != nil {
			break
		}
	}
}

func (a *App) handleDifyChatProxy(w http.ResponseWriter, req *http.Request) {
	// Get plugin configuration
	pluginConfig := backend.PluginConfigFromContext(req.Context())
	jsonData := pluginConfig.AppInstanceSettings.JSONData
	secureJsonData := pluginConfig.AppInstanceSettings.DecryptedSecureJSONData

	// Parse configuration
	var config map[string]interface{}
	if err := json.Unmarshal(jsonData, &config); err != nil {
		http.Error(w, "Invalid JSONData", http.StatusInternalServerError)
		return
	}

	// Get API URL from configuration
	apiUrl, ok := config["apiUrl"].(string)
	if !ok {
		http.Error(w, "apiUrl not found or not a string", http.StatusBadRequest)
		return
	}

	// Get API key from secure configuration
	apiKey, ok := secureJsonData["apiKey"]
	if !ok {
		http.Error(w, "API key is not set", http.StatusBadRequest)
		return
	}

	// Handle request body - if no body or empty body, use empty object as default
	if req.Body == nil || req.ContentLength == 0 {
		// No body provided, use empty object as default
		http.Error(w, "Request body cannot be empty", http.StatusBadRequest)
		return
	} else {
		// Check content length to prevent oversized requests (max 10MB)
		if req.ContentLength > 10*1024*1024 {
			http.Error(w, "Request body too large (max 10MB)", http.StatusRequestEntityTooLarge)
			return
		}

		// Parse the incoming request body to extract inputs
		var requestBody map[string]interface{}
		if err := json.NewDecoder(req.Body).Decode(&requestBody); err != nil {
			http.Error(w, "Invalid JSON in request body: "+err.Error(), http.StatusBadRequest)
			return
		}
		
		if requestBody["query"] == nil {
			http.Error(w, "query field is required in the request body", http.StatusBadRequest)
			return
		} else {
			if requestBody["query"] == "" {
				http.Error(w, "query field cannot be empty", http.StatusBadRequest)
				return
			}
			chat_message_endpoint := apiUrl + "/chat-messages"

			username := "grafana-user"
			conversation_id := ""

			payload := map[string]interface{}{
				"inputs": map[string]interface{}{},
				"query": requestBody["query"].(string),
				"response_mode": "streaming",
				"conversation_id": conversation_id,
				"user": username,
				"files": []map[string]interface{}{},
			}

			bodyBytes, _ := json.Marshal(payload)
			req, err := http.NewRequest("POST", chat_message_endpoint, bytes.NewReader(bodyBytes))
			if err != nil {
				http.Error(w, "Failed to create Dify API Request: "+err.Error(), http.StatusInternalServerError)
				return
			}

			req.Header.Set("Authorization", "Bearer "+apiKey)
			req.Header.Set("Content-Type", "application/json")

			client := &http.Client{}
			resp, err := client.Do(req)
			if err != nil {
				http.Error(w, "Failed to call Dify API: "+err.Error(), http.StatusInternalServerError)
				return
			}
			defer resp.Body.Close()

			w.WriteHeader(resp.StatusCode)
			for k, vv := range resp.Header {
				// Skip Content-Length to allow streaming
				if k == "Content-Length" {
					continue
				}
				for _, v := range vv {
					w.Header().Add(k, v)
				}
			}

			// Ensure content-type is text/event-stream
			w.Header().Set("Content-Type", "text/event-stream")

			// Flush interface to push data immediately
			flusher, ok := w.(http.Flusher)
			if !ok {
				http.Error(w, "Streaming unsupported!", http.StatusInternalServerError)
				return
			}

			// Stream response directly to client
			buf := make([]byte, 4096)
			for {
				n, err := resp.Body.Read(buf)
				if n > 0 {
					_, writeErr := w.Write(buf[:n])
					if writeErr != nil {
						log.DefaultLogger.Debug("Error writing to client: %v", writeErr)
						break
					}
					flusher.Flush()
				}
				if err != nil {
					if err != io.EOF {
						log.DefaultLogger.Debug("Error reading from backend: %v", err)
					}
					break
				}
			}
		}
	}
}

// handleDifyGetConversations proxies GET requests to Dify's /v1/conversations endpoint
func (a *App) handleDifyGetConversations(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get plugin configuration
	pluginConfig := backend.PluginConfigFromContext(req.Context())
	jsonData := pluginConfig.AppInstanceSettings.JSONData
	secureJsonData := pluginConfig.AppInstanceSettings.DecryptedSecureJSONData

	// Parse configuration
	var config map[string]interface{}
	if err := json.Unmarshal(jsonData, &config); err != nil {
		http.Error(w, "Invalid JSONData", http.StatusInternalServerError)
		return
	}

	apiUrl, ok := config["apiUrl"].(string)
	if !ok {
		http.Error(w, "apiUrl not found or not a string", http.StatusBadRequest)
		return
	}
	apiKey, ok := secureJsonData["apiKey"]
	if !ok {
		http.Error(w, "API key is not set", http.StatusBadRequest)
		return
	}

	// Build Dify API URL with query params, hardcoding user=grafana-user
	difyURL := apiUrl + "/v1/conversations"
	q := req.URL.Query()
	q.Set("user", "grafana-user") // hard code user
	// Only allow/forward specific query params
	params := []string{"user", "last_id", "limit", "sort_by"}
	outQ := make([]string, 0, len(params))
	for _, p := range params {
		if v := q.Get(p); v != "" {
			outQ = append(outQ, p+"="+v)
		}
	}
	if len(outQ) > 0 {
		difyURL += "?" + q.Encode()
	}

	// Create request to Dify
	proxyReq, err := http.NewRequest("GET", difyURL, nil)
	if err != nil {
		http.Error(w, "Failed to create request to Dify", http.StatusInternalServerError)
		return
	}
	proxyReq.Header.Set("Authorization", "Bearer "+apiKey)
	proxyReq.Header.Set("Accept", "application/json")

	// Make the request
	client := &http.Client{}
	resp, err := client.Do(proxyReq)
	if err != nil {
		http.Error(w, "Failed to call Dify API: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	// Copy response headers and body
	for k, v := range resp.Header {
		for _, vv := range v {
			w.Header().Add(k, vv)
		}
	}
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

// registerRoutes takes a *http.ServeMux and registers some HTTP handlers.
func (a *App) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/ping", a.handlePing)
	mux.HandleFunc("/echo", a.handleEcho)
	mux.HandleFunc("/difyWorkflow", a.handleDifyWorkflow)
	mux.HandleFunc("/difyWorkflowProxy", a.handleDifyWorkflowProxy)
	mux.HandleFunc("/difyChatProxy", a.handleDifyChatProxy)
	mux.HandleFunc("/difyGetConversations", a.handleDifyGetConversations)
}
