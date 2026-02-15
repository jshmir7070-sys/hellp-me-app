import * as Location from 'expo-location';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '@/lib/query-client';
import { getToken } from '@/utils/secure-token-storage';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

let locationSubscription: Location.LocationSubscription | null = null;
let updateInterval: NodeJS.Timeout | null = null;

export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    console.log('Location tracking limited on web');
    return false;
  }

  const { status: existingStatus } = await Location.getForegroundPermissionsAsync();

  if (existingStatus === 'granted') {
    return true;
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getLocationPermissionStatus(): Promise<Location.PermissionStatus> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status;
}

export async function getCurrentLocation(): Promise<LocationData | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      timestamp: location.timestamp,
    };
  } catch (error) {
    console.error('Error getting current location:', error);
    return null;
  }
}

export async function sendLocationToServer(location: LocationData): Promise<boolean> {
  try {
    const token = await getToken();
    if (!token) {
      console.log('No auth token, cannot send location');
      return false;
    }

    const response = await fetch(
      new URL('/api/location/update', getApiUrl()).toString(),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          timestamp: new Date(location.timestamp).toISOString(),
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Error sending location to server:', error);
    return false;
  }
}

export async function startLocationTracking(
  intervalMs: number = 5 * 60 * 1000,
  onLocationUpdate?: (location: LocationData) => void
): Promise<boolean> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      return false;
    }

    await stopLocationTracking();

    const sendUpdate = async () => {
      const location = await getCurrentLocation();
      if (location) {
        await sendLocationToServer(location);
        onLocationUpdate?.(location);
      }
    };

    await sendUpdate();

    updateInterval = setInterval(sendUpdate, intervalMs);

    await AsyncStorage.setItem('locationTrackingActive', 'true');
    return true;
  } catch (error) {
    console.error('Error starting location tracking:', error);
    return false;
  }
}

export async function stopLocationTracking(): Promise<void> {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }

  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }

  await AsyncStorage.removeItem('locationTrackingActive');
}

export async function isLocationTrackingActive(): Promise<boolean> {
  const active = await AsyncStorage.getItem('locationTrackingActive');
  return active === 'true';
}

export async function getLastKnownLocation(): Promise<LocationData | null> {
  try {
    const lastLocation = await Location.getLastKnownPositionAsync();
    if (!lastLocation) {
      return null;
    }

    return {
      latitude: lastLocation.coords.latitude,
      longitude: lastLocation.coords.longitude,
      accuracy: lastLocation.coords.accuracy,
      timestamp: lastLocation.timestamp,
    };
  } catch (error) {
    console.error('Error getting last known location:', error);
    return null;
  }
}

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<string | null> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (results.length > 0) {
      const addr = results[0];
      const parts = [
        addr.region,
        addr.city,
        addr.district,
        addr.street,
        addr.streetNumber,
      ].filter(Boolean);
      return parts.join(' ');
    }
    return null;
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return null;
  }
}
