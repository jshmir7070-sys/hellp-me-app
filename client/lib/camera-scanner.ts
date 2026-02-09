import { useRef, useCallback, useState, useEffect } from 'react';
import { Camera, CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';

export type ScanResult = {
  type: string;
  data: string;
  timestamp: number;
};

export type UseCameraScannerOptions = {
  onScan: (result: ScanResult) => void;
  debounceMs?: number;
  enabled?: boolean;
};

export function useCameraScanner({
  onScan,
  debounceMs = 2000,
  enabled = true,
}: UseCameraScannerOptions) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const lastScanRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const scanLockRef = useRef<boolean>(false);

  const handleBarCodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (!enabled || scanLockRef.current) {
        return;
      }

      const now = Date.now();
      const scannedData = result.data;

      if (
        lastScanRef.current === scannedData &&
        now - lastScanTimeRef.current < debounceMs
      ) {
        return;
      }

      scanLockRef.current = true;
      lastScanRef.current = scannedData;
      lastScanTimeRef.current = now;

      const scanResult: ScanResult = {
        type: result.type,
        data: scannedData,
        timestamp: now,
      };

      onScan(scanResult);

      setTimeout(() => {
        scanLockRef.current = false;
      }, debounceMs);
    },
    [enabled, debounceMs, onScan]
  );

  const resetScanner = useCallback(() => {
    lastScanRef.current = null;
    lastScanTimeRef.current = 0;
    scanLockRef.current = false;
  }, []);

  const startScanning = useCallback(() => {
    setIsScanning(true);
    resetScanner();
  }, [resetScanner]);

  const stopScanning = useCallback(() => {
    setIsScanning(false);
    scanLockRef.current = true;
  }, []);

  useEffect(() => {
    return () => {
      scanLockRef.current = true;
    };
  }, []);

  return {
    permission,
    requestPermission,
    isScanning,
    startScanning,
    stopScanning,
    handleBarCodeScanned,
    resetScanner,
    hasPermission: permission?.granted ?? false,
    canAskAgain: permission?.canAskAgain ?? true,
  };
}

export { CameraView, useCameraPermissions };
