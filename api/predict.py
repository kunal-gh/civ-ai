from http.server import BaseHTTPRequestHandler
import json
import os
import numpy as np
import joblib

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'models/rf_model.pkl')
CENTROID_PATH = os.path.join(os.path.dirname(__file__), 'models/centroid.pkl')

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        try:
            content_len = int(self.headers.get('Content-Length', 0))
            post_body = self.rfile.read(content_len)
            data = json.loads(post_body.decode('utf-8'))
            
            # Load assets
            model = joblib.load(MODEL_PATH)
            centroid = joblib.load(CENTROID_PATH)
            
            state = data.get('state', {})
            cols = [
                'population', 'food', 'energy', 'technology', 'pollution', 'economy',
                'happiness', 'legitimacy', 'disease_rate', 'military', 'climate',
                'water', 'minerals', 'trust', 'fear', 'anger', 'hope'
            ]
            x_val = []
            for c in cols:
                x_val.append(float(state.get(c, 0.0)))
            
            x_arr = np.array([x_val])
            
            # 1. Prediction
            pred_delta = int(model.predict(x_arr)[0])
            
            # 2. Explainability (Feature Importances)
            importances = model.feature_importances_
            feat_imp = {}
            for i, col in enumerate(cols):
                feat_imp[col] = float(importances[i])
                
            sorted_imp = dict(sorted(feat_imp.items(), key=lambda item: item[1], reverse=True)[:5])
            
            # 3. OOD Detection (Distance from training distribution)
            mean = np.array([centroid['mean'][c] for c in cols])
            std = np.array([max(centroid['std'][c], 1e-6) for c in cols])
            dist = float(np.linalg.norm((x_arr[0] - mean) / std))
            
            if dist < 3.0:
                confidence = "HIGH"
            elif dist < 5.0:
                confidence = "MEDIUM"
            else:
                confidence = "LOW"
            
            result = {
                "predicted_delta": pred_delta,
                "feature_importances": sorted_imp,
                "confidence": confidence,
                "distance": dist
            }
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode('utf-8'))
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
