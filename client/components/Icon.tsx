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
    "refresh-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M23 4v6h-6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M1 20v-6h6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "star": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={color} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "person": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="7" r="4" fill={color} stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" fill={color} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "people": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="9" cy="7" r="4" fill={color} stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" fill={color} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Circle cx="19" cy="7" r="3" fill={color} stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M23 21v-2a3 3 0 00-3-3h-1" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "close": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "add": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "checkmark-circle": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="10" fill={color}/>
        <Path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "close-circle": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="10" fill={color}/>
        <Path d="M15 9l-6 6M9 9l6 6" stroke="#fff" strokeWidth={2} strokeLinecap="round"/>
      </Svg>
    ),
    "images-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="5" y="5" width="16" height="16" rx="2" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M3 9v10a2 2 0 002 2h10" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
        <Circle cx="11" cy="11" r="1.5" fill={color}/>
        <Path d="M21 17l-4-4-6 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "bell-off-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M13.73 21a2 2 0 01-3.46 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
        <Path d="M18 8A6 6 0 006 8c0 3.09-.78 5.24-1.71 6.67" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
        <Path d="M18 8c0 2.8.63 5 1.68 6.52" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
        <Path d="M1 1l22 22" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "inbox-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M22 12H16l-2 3H10l-2-3H2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "barcode-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14M21 5v14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "shield-checkmark-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M9 12l2 2 4-4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "qr-code-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="3" y="3" width="7" height="7" stroke={color} strokeWidth={strokeWidth}/>
        <Rect x="14" y="3" width="7" height="7" stroke={color} strokeWidth={strokeWidth}/>
        <Rect x="3" y="14" width="7" height="7" stroke={color} strokeWidth={strokeWidth}/>
        <Rect x="14" y="14" width="3" height="3" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M21 14h-3v3M21 17v4h-4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "exit-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M16 17l5-5-5-5M21 12H9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "account-plus-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="10" cy="7" r="4" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M18 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M20 8v4M18 10h4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "paperclip": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "navigation": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M3 11l19-9-9 19-2-8-8-2z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "arrow-expand": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "open-in-new": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M15 3h6v6M10 14L21 3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "tune": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
        <Path d="M1 14h6M9 8h6M17 16h6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "cellphone": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="5" y="2" width="14" height="20" rx="2" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M12 18h.01" stroke={color} strokeWidth={2} strokeLinecap="round"/>
      </Svg>
    ),
    "camera-off-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M1 1l22 22" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
        <Path d="M21 21H3a2 2 0 01-2-2V8a2 2 0 012-2h3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M21 8v11M15.28 6H21a2 2 0 012 0M10 6l2-3h4l2 3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "checkbox": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="3" y="3" width="18" height="18" rx="3" fill={color} stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "square-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="3" y="3" width="18" height="18" rx="3" stroke={color} strokeWidth={strokeWidth}/>
      </Svg>
    ),
    "chatbubble-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "chatbubbles-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M8 10h8M8 14h4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "chatbubble-ellipses-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Circle cx="8" cy="12" r="1" fill={color}/>
        <Circle cx="12" cy="12" r="1" fill={color}/>
        <Circle cx="16" cy="12" r="1" fill={color}/>
      </Svg>
    ),
    "business-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M9 9h1M9 13h1M9 17h1" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "remove-circle-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth}/>
        <Path d="M8 12h8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "rotate-left": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M1 4v6h6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M3.51 15a9 9 0 102.13-9.36L1 10" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "crop-free": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M3 9V5a2 2 0 012-2h4M15 3h4a2 2 0 012 2v4M21 15v4a2 2 0 01-2 2h-4M9 21H5a2 2 0 01-2-2v-4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "fullscreen": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    ),
    "map-outline": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M8 2v16M16 6v16" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      </Svg>
    ),
    "chevron-down": (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
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
