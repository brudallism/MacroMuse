import React, { useState } from 'react'
import { View, StyleSheet, Alert } from 'react-native'
import { WebView } from 'react-native-webview'

import { Text } from '@ui/atoms/Text'
import { Button } from '@ui/atoms/Button'
import { useTheme } from '@ui/theme/ThemeProvider'

import { logger } from '@lib/logger'

interface WebBarcodeScannerProps {
  onComplete: () => void
  onManualEntry: () => void
  userId: string
}

const SCANNER_HTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Barcode Scanner</title>
    <script src="https://unpkg.com/@zxing/library@latest/umd/index.min.js"></script>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #000;
            color: white;
            text-align: center;
        }
        #video {
            width: 100%;
            max-width: 400px;
            height: 300px;
            border: 2px solid #00ff00;
            border-radius: 8px;
        }
        .controls {
            margin: 20px 0;
        }
        button {
            background: #007AFF;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            margin: 0 10px;
            cursor: pointer;
        }
        button:hover {
            background: #0056b3;
        }
        button:disabled {
            background: #666;
            cursor: not-allowed;
        }
        .result {
            margin: 20px 0;
            padding: 15px;
            background: rgba(0, 255, 0, 0.1);
            border: 1px solid #00ff00;
            border-radius: 8px;
            display: none;
        }
        .error {
            background: rgba(255, 0, 0, 0.1);
            border-color: #ff0000;
            color: #ff6666;
        }
    </style>
</head>
<body>
    <h2>📱 Barcode Scanner</h2>
    <p>Point your camera at a barcode</p>

    <video id="video" autoplay></video>

    <div class="controls">
        <button id="startBtn" onclick="startScanning()">Start Camera</button>
        <button id="stopBtn" onclick="stopScanning()" disabled>Stop Camera</button>
        <button onclick="manualEntry()">Manual Entry</button>
    </div>

    <div id="result" class="result">
        <h3>Barcode Found!</h3>
        <p id="barcodeText"></p>
        <button onclick="lookupProduct()">Look Up Product</button>
        <button onclick="continueScanning()">Scan Another</button>
    </div>

    <div id="error" class="result error" style="display: none;">
        <h3>Error</h3>
        <p id="errorText"></p>
        <button onclick="startScanning()">Try Again</button>
    </div>

    <script>
        let codeReader = null;
        let currentStream = null;
        let lastScannedCode = null;

        async function startScanning() {
            try {
                document.getElementById('error').style.display = 'none';
                document.getElementById('result').style.display = 'none';

                codeReader = new ZXing.BrowserMultiFormatReader();
                const videoElement = document.getElementById('video');

                currentStream = await codeReader.decodeFromVideoDevice(undefined, videoElement, (result, err) => {
                    if (result) {
                        const code = result.getText();
                        if (code !== lastScannedCode) {
                            lastScannedCode = code;
                            handleBarcodeFound(code);
                        }
                    }
                });

                document.getElementById('startBtn').disabled = true;
                document.getElementById('stopBtn').disabled = false;

            } catch (err) {
                showError('Camera access denied or not available. Please allow camera permissions.');
            }
        }

        function stopScanning() {
            if (codeReader) {
                codeReader.reset();
                codeReader = null;
            }
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
                currentStream = null;
            }

            document.getElementById('startBtn').disabled = false;
            document.getElementById('stopBtn').disabled = true;
        }

        function handleBarcodeFound(code) {
            stopScanning();
            document.getElementById('barcodeText').textContent = code;
            document.getElementById('result').style.display = 'block';

            // Send result to React Native
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'BARCODE_SCANNED',
                data: code
            }));
        }

        function lookupProduct() {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'LOOKUP_PRODUCT',
                data: lastScannedCode
            }));
        }

        function continueScanning() {
            document.getElementById('result').style.display = 'none';
            lastScannedCode = null;
            startScanning();
        }

        function manualEntry() {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'MANUAL_ENTRY'
            }));
        }

        function showError(message) {
            document.getElementById('errorText').textContent = message;
            document.getElementById('error').style.display = 'block';
        }
    </script>
</body>
</html>
`;

export const WebBarcodeScanner: React.FC<WebBarcodeScannerProps> = ({
  onComplete,
  onManualEntry,
}) => {
  const theme = useTheme()
  const [isWebView, setIsWebView] = useState(false)

  const handleMessage = async (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data)

      switch (message.type) {
        case 'BARCODE_SCANNED':
          logger.info('Barcode scanned from WebView', { barcode: message.data })
          break

        case 'LOOKUP_PRODUCT':
          await lookupProduct(message.data)
          break

        case 'MANUAL_ENTRY':
          setIsWebView(false)
          onManualEntry()
          break
      }
    } catch (error) {
      logger.error('WebView message parsing error', { error })
    }
  }

  const lookupProduct = async (barcode: string) => {
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, {
        headers: {
          'User-Agent': 'MacroMuse/1.0.0 (nutrition tracker app)'
        }
      })

      if (response.ok) {
        const data = await response.json()

        if (data.status === 1 && data.product) {
          const product = data.product
          const productName = product.product_name || 'Unknown Product'
          const brand = product.brands || 'Unknown Brand'
          const calories = product.nutriments?.['energy-kcal_100g'] || 'N/A'

          Alert.alert(
            '✅ Product Found!',
            `${productName}\n\nBrand: ${brand}\nCalories: ${calories} per 100g`,
            [
              {
                text: '➕ Add to Log',
                onPress: () => {
                  Alert.alert('Added!', `${productName} added to your food log`)
                  onComplete()
                }
              },
              { text: '✏️ Manual Entry', onPress: onManualEntry },
              { text: '📱 Continue Scanning', onPress: () => {} }
            ]
          )
        } else {
          Alert.alert(
            '❌ Product Not Found',
            `Barcode ${barcode} not found in database.`,
            [
              { text: '✏️ Manual Entry', onPress: onManualEntry },
              { text: '📱 Continue Scanning', onPress: () => {} }
            ]
          )
        }
      }
    } catch (error) {
      Alert.alert(
        '⚠️ Lookup Failed',
        'Check your internet connection.',
        [
          { text: '✏️ Manual Entry', onPress: onManualEntry },
          { text: '📱 Try Again', onPress: () => {} }
        ]
      )
    }
  }

  if (isWebView) {
    return (
      <View style={styles.container}>
        <WebView
          source={{ html: SCANNER_HTML }}
          style={styles.webView}
          onMessage={handleMessage}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
        />
        <Button
          title="❌ Close Scanner"
          onPress={() => setIsWebView(false)}
          variant="outline"
          style={styles.closeButton}
        />
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      <Text style={[styles.title, { color: theme.colors.text.primary }]}>
        📱 Web Barcode Scanner
      </Text>

      <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
        Camera scanning powered by web technology
      </Text>

      <Button
        title="📷 Open Camera Scanner"
        onPress={() => setIsWebView(true)}
        style={styles.button}
      />

      <Button
        title="✏️ Manual Entry"
        onPress={onManualEntry}
        variant="secondary"
        style={styles.button}
      />

      <Button
        title="✅ Done"
        onPress={onComplete}
        variant="outline"
        style={styles.button}
      />

      <Text style={[styles.helpText, { color: theme.colors.text.tertiary }]}>
        Uses your device's camera through the web browser. No app permissions needed!
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 60,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  button: {
    marginHorizontal: 20,
    marginBottom: 15,
  },
  helpText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 40,
    lineHeight: 18,
  },
  webView: {
    flex: 1,
  },
  closeButton: {
    margin: 20,
  },
})