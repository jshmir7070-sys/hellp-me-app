import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import { getApiUrl } from '@/lib/query-client';

export type LocationData = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
};

export type UseLocationOptions = {
  enableHighAccuracy?: boolean;
  updateInterval?: number;
  autoStart?: boolean;
};

export function useLocation(options: UseLocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    updateInterval = 30000,
    autoStart = false,
  } = options;

  const [permission, requestPermission] = Location.useForegroundPermissions();
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watcherRef = useRef<Location.LocationSubscription | null>(null);

  const getLocation = useCallback(async (): Promise<LocationData | null> => {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: enableHighAccuracy
          ? Location.Accuracy.High
          : Location.Accuracy.Balanced,
      });

      const locationData: LocationData = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        timestamp: loc.timestamp,
      };

      setLocation(locationData);
      setError(null);
      return locationData;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '위치를 가져올 수 없습니다';
      setError(errorMessage);
      return null;
    }
  }, [enableHighAccuracy]);

  const startTracking = useCallback(async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setError('위치 권한이 필요합니다');
        return false;
      }
    }

    setIsTracking(true);
    setError(null);

    await getLocation();

    intervalRef.current = setInterval(async () => {
      await getLocation();
    }, updateInterval);

    return true;
  }, [permission, requestPermission, getLocation, updateInterval]);

  const stopTracking = useCallback(() => {
    setIsTracking(false);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (watcherRef.current) {
      watcherRef.current.remove();
      watcherRef.current = null;
    }
  }, []);

  const sendLocationToServer = useCallback(
    async (token: string): Promise<boolean> => {
      if (!location) {
        return false;
      }

      try {
        const response = await fetch(
          new URL('/api/location/update', getApiUrl()).toString(),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              latitude: location.latitude,
              longitude: location.longitude,
              accuracy: location.accuracy,
              timestamp: location.timestamp,
            }),
          }
        );

        return response.ok;
      } catch (err) {
        console.error('Failed to send location:', err);
        return false;
      }
    },
    [location]
  );

  useEffect(() => {
    if (autoStart && permission?.granted) {
      startTracking();
    }

    return () => {
      stopTracking();
    };
  }, [autoStart, permission?.granted]);

  return {
    permission,
    requestPermission,
    location,
    isTracking,
    error,
    getLocation,
    startTracking,
    stopTracking,
    sendLocationToServer,
    hasPermission: permission?.granted ?? false,
    canAskAgain: permission?.canAskAgain ?? true,
  };
}

export async function getAddressFromCoords(
  latitude: number,
  longitude: number
): Promise<string | null> {
  try {
    const result = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    if (result.length > 0) {
      const addr = result[0];
      const parts = [
        addr.city,
        addr.district,
        addr.street,
        addr.streetNumber,
      ].filter(Boolean);
      return parts.join(' ') || null;
    }
    return null;
  } catch (err) {
    console.error('Reverse geocode error:', err);
    return null;
  }
}
