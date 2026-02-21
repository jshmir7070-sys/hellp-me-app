import React from "react";
import { View, ViewStyle } from "react-native";
import Svg, { Path, Circle, Rect, Line, Polyline } from "react-native-svg";

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export function Icon({ name, size = 24, color = "#000", style }: IconProps) {
  const strokeWidth = 1.5;
  
  const icons: Record<string, React.ReactNode> = {
    "home-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M9 22V12h6v10" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "document-text-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "add-circle-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M12 8v8M8 12h8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "checkmark-circle-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M9 12l2 2 4-4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "card-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="1" y="4" width="22" height="16" rx="2" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M1 10h22" stroke={color} strokeWidth={strokeWidth}/>
      </Svg>
    ),
    "star-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "person-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="7" r="4" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "people-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="9" cy="7" r="4" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Circle cx="19" cy="7" r="3" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M23 21v-2a3 3 0 00-3-3h-1" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "notifications-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M13.73 21a2 2 0 01-3.46 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "chevron-forward-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M9 18l6-6-6-6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "chevron-back-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M15 18l-6-6 6-6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "chevron-down-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "chevron-up-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M18 15l-6-6-6 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "calendar-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "time-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M12 6v6l4 2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "location-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke={color} strokeWidth={strokeWidth}/>
        <Circle cx="12" cy="10" r="3" stroke={color} strokeWidth={strokeWidth}/>
      </Svg>
    ),
    "call-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "mail-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="2" y="4" width="20" height="16" rx="2" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M22 6l-10 7L2 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "camera-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={color} strokeWidth={strokeWidth}/>
        <Circle cx="12" cy="13" r="4" stroke={color} strokeWidth={strokeWidth}/>
      </Svg>
    ),
    "image-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="3" y="3" width="18" height="18" rx="2" stroke={color} strokeWidth={strokeWidth}/>
        <Circle cx="8.5" cy="8.5" r="1.5" fill={color}/>
        <Path d="M21 15l-5-5L5 21" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "car-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M5 17h14v-5l-2-5H7L5 12z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M3 17h18v2H3z" stroke={color} strokeWidth={strokeWidth}/>
        <Circle cx="7" cy="17" r="2" stroke={color} strokeWidth={strokeWidth}/>
        <Circle cx="17" cy="17" r="2" stroke={color} strokeWidth={strokeWidth}/>
      </Svg>
    ),
    "cube-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "cash-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "warning-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M12 9v4M12 17h.01" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "information-circle-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M12 16v-4M12 8h.01" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "alert-circle-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M12 8v4M12 16h.01" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "close-circle-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M15 9l-6 6M9 9l6 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "checkmark-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "close-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "add-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "remove-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M5 12h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "search-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="11" cy="11" r="8" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M21 21l-4.35-4.35" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "settings-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke={color} strokeWidth={strokeWidth}/>
      </Svg>
    ),
    "log-out-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M16 17l5-5-5-5M21 12H9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "log-in-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M10 17l5-5-5-5M15 12H3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "help-circle-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M12 17h.01" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "eye-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={color} strokeWidth={strokeWidth}/>
        <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={strokeWidth}/>
      </Svg>
    ),
    "eye-off-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M1 1l22 22" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "lock-closed-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="3" y="11" width="18" height="11" rx="2" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M7 11V7a5 5 0 0110 0v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "shield-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "trash-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "create-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "copy-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="9" y="9" width="13" height="13" rx="2" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "share-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="18" cy="5" r="3" stroke={color} strokeWidth={strokeWidth}/>
        <Circle cx="6" cy="12" r="3" stroke={color} strokeWidth={strokeWidth}/>
        <Circle cx="18" cy="19" r="3" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" stroke={color} strokeWidth={strokeWidth}/>
      </Svg>
    ),
    "download-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M7 10l5 5 5-5M12 15V3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "cloud-upload-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M16 16l-4-4-4 4M12 12v9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "send-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "chatbox-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "arrow-forward-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M5 12h14M12 5l7 7-7 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "arrow-back-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M19 12H5M12 19l-7-7 7-7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "ellipsis-vertical-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="1" fill={color}/>
        <Circle cx="12" cy="5" r="1" fill={color}/>
        <Circle cx="12" cy="19" r="1" fill={color}/>
      </Svg>
    ),
    "ellipsis-horizontal-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="1" fill={color}/>
        <Circle cx="5" cy="12" r="1" fill={color}/>
        <Circle cx="19" cy="12" r="1" fill={color}/>
      </Svg>
    ),
    "filter-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "folder-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "briefcase-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="2" y="7" width="20" height="14" rx="2" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" stroke={color} strokeWidth={strokeWidth}/>
      </Svg>
    ),
    "clipboard-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" stroke={color} strokeWidth={strokeWidth}/>
        <Rect x="8" y="2" width="8" height="4" rx="1" stroke={color} strokeWidth={strokeWidth}/>
      </Svg>
    ),
    "list-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "grid-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="3" y="3" width="7" height="7" stroke={color} strokeWidth={strokeWidth}/>
        <Rect x="14" y="3" width="7" height="7" stroke={color} strokeWidth={strokeWidth}/>
        <Rect x="14" y="14" width="7" height="7" stroke={color} strokeWidth={strokeWidth}/>
        <Rect x="3" y="14" width="7" height="7" stroke={color} strokeWidth={strokeWidth}/>
      </Svg>
    ),
    "globe-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke={color} strokeWidth={strokeWidth}/>
      </Svg>
    ),
    "link-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "book-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke={color} strokeWidth={strokeWidth}/>
      </Svg>
    ),
    "print-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M6 9V2h12v7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Rect x="6" y="14" width="12" height="8" stroke={color} strokeWidth={strokeWidth}/>
      </Svg>
    ),
    "document-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M14 2v6h6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "call": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" fill={color} stroke={color} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "person-add-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="9" cy="7" r="4" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M20 8v6M23 11h-6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "megaphone-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M21 3L9 9H3a1 1 0 00-1 1v4a1 1 0 001 1h1l2 7h3l-2-7h2l12 6V3z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "shield-checkmark-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M9 12l2 2 4-4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "checkmark-done-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M18 6L7 17l-5-5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M22 10L11 21" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "chatbubbles-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "open-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M15 3h6v6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M10 14L21 3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "refresh-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M23 4v6h-6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M1 20v-6h6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
  };

  const iconElement = icons[name] || (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth}/>
    </Svg>
  );

  return style ? <View style={style}>{iconElement}</View> : iconElement;
}

export default Icon;
