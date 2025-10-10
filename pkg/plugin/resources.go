package plugin

import (
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
	if !ok  {
		http.Error(w, "API key is not set", http.StatusBadRequest)
		return
	}else {
		
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

// registerRoutes takes a *http.ServeMux and registers some HTTP handlers.
func (a *App) registerRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/ping", a.handlePing)
	mux.HandleFunc("/echo", a.handleEcho)
	mux.HandleFunc("/difyWorkflow", a.handleDifyWorkflow)
}
