/**
 * QR Scanner View Component
 * Camera-based QR code scanner with overlay
 */

import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  Pressable,
  Dimensions,
} from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';

export interface QRScannerViewProps {
  onCodeDetected: (code: string) => void;
  onCancel: () => void;
  instructionText?: string;
  enableVibration?: boolean;
}

export const QRScannerView: React.FC<QRScannerViewProps> = ({
  onCodeDetected,
  onCancel,
  instructionText = 'Position QR code within the frame',
  enableVibration = true,
}) => {
  const devices = useCameraDevices();
  const device = devices.back;
  const [isActive, setIsActive] = React.useState(true);
  const [scanned, setScanned] = React.useState(false);

  const handleCodeDetected = React.useCallback(
    (code: string) => {
      if (!scanned) {
        setScanned(true);
        setIsActive(false);
        onCodeDetected(code);

        // Vibrate on successful scan
        if (enableVibration) {
          // Haptic feedback would go here
        }
      }
    },
    [scanned, onCodeDetected, enableVibration]
  );

  const resetScanner = () => {
    setScanned(false);
    setIsActive(true);
  };

  if (!device) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Camera not available</Text>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Close</Text>
        </Pressable>
      </View>
    );
  }

  const { width: screenWidth } = Dimensions.get('window');
  const scanSize = screenWidth * 0.7;

  return (
    <View style={styles.container}>
      <Camera
        style={styles.camera}
        device={device}
        isActive={isActive && !scanned}
        onError={(error) => console.error('Camera error:', error)}
      />

      {/* Dark overlay */}
      <View style={styles.overlay}>
        <View style={[styles.overlayTop, { height: (screenWidth - scanSize) / 2 }]} />
        <View style={styles.overlayMiddle}>
          <View style={[styles.overlaySide, { width: (screenWidth - scanSize) / 2 }]} />
          <View style={[styles.scanArea, { width: scanSize, height: scanSize }]}>
            {/* Corner markers */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />

            {/* Scan line animation */}
            {!scanned && (
              <View style={styles.scanLineContainer}>
                <View style={styles.scanLine} />
              </View>
            )}
          </View>
          <View style={[styles.overlaySide, { width: (screenWidth - scanSize) / 2 }]} />
        </View>
        <View style={styles.overlayBottom}>
          <Text style={styles.instruction}>{instructionText}</Text>
        </View>
      </View>

      {/* Cancel button */}
      <View style={styles.buttonContainer}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </View>

      {/* Reset button for scanned state */}
      {scanned && (
        <View style={styles.resetContainer}>
          <Pressable style={styles.resetButton} onPress={resetScanner}>
            <Text style={styles.resetButtonText}>Scan Another</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  errorText: {
    color: '#FFF',
    fontSize: 16,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTop: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  overlayMiddle: {
    flex: 1,
    flexDirection: 'row',
  },
  overlaySide: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  overlayBottom: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  scanArea: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#007AFF',
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  scanLineContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanLine: {
    width: '80%',
    height: 2,
    backgroundColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  instruction: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cancelButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resetContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  resetButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
  },
  resetButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
