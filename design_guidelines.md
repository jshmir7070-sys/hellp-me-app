# Hellp Me - Design Guidelines

## 1. Brand Identity

**Purpose**: Connect delivery drivers (헬퍼) with businesses needing delivery services through efficient matching, transparent contracts, and reliable settlement systems.

**Aesthetic Direction**: **Professional/Corporate-Trustworthy** - Clean, systematic, confidence-building. Think financial app meets logistics platform. Modern and sophisticated design with attention to detail.

**Memorable Element**: Color-coded user type distinction (drivers vs. businesses) that carries throughout the entire experience, making role clarity instant and unmistakable.

## 2. Color Palette

### Primary Colors
- **Primary**: `#1E40AF` (Deep Blue) - Main brand color, CTAs, navigation
- **Primary Light**: `#3B82F6` (Bright Blue) - Links, interactive elements
- **Primary Dark**: `#1E3A8A` (Navy) - Headers, emphasis

### Role-Based Colors
- **Helper (Driver)**: `#1E40AF` with light background `#DBEAFE`
- **Requester (Business)**: `#059669` with light background `#D1FAE5`

### Semantic Colors
- **Success**: `#22C55E`
- **Warning**: `#F59E0B`
- **Error**: `#DC2626`

### Social Login Colors
- **Kakao**: `#FEE500`
- **Naver**: `#03C75A`

### Gray Palette (Tailwind-based)
- **Gray 900**: `#111827` - Primary text (light mode)
- **Gray 800**: `#1F2937` - Secondary text, dark backgrounds
- **Gray 700**: `#374151` - Tertiary elements
- **Gray 600**: `#4B5563`
- **Gray 500**: `#6B7280` - Placeholder text, icons
- **Gray 400**: `#9CA3AF` - Disabled states
- **Gray 300**: `#D1D5DB` - Borders
- **Gray 200**: `#E5E7EB` - Dividers
- **Gray 100**: `#F3F4F6` - Card backgrounds
- **Gray 50**: `#F9FAFB` - Page backgrounds

## 3. Typography

**Primary Font**: Inter (modern, clean, excellent readability)
**Fallback**: System default (SF Pro for iOS, Roboto for Android)

**Type Scale**:
- Hero: 32px, Bold
- H1: 24px, Bold
- H2: 20px, SemiBold
- H3: 18px, SemiBold
- Body Large: 16px, Regular
- Body: 14px, Regular
- Caption: 12px, Regular
- Button: 16px, SemiBold

## 4. Navigation Architecture

**Root Navigation**: Tab Navigation (4 tabs for Drivers, 3 tabs for Businesses)

**Driver Tabs**:
- Home (available jobs, active contracts)
- Jobs (browse all available jobs)
- My Jobs (history, earnings)
- Profile (settings, payment info)

**Business Tabs**:
- Dashboard (overview, active helpers)
- Contracts (manage agreements)
- Profile (company info, payment settings)

## 5. Screen Specifications

### Authentication Flow
**Screens**: Splash → Login → Registration (2-step: Account Type Selection → Details Form)

**Login Screen**:
- Layout: Centered card on gradient background
- Components: Logo, phone number input, SMS verification, Kakao/Naver/Apple SSO buttons
- Primary button uses `#1E40AF`

**Registration Screen**:
- Step 1: Choose account type (Driver or Business) with large cards
- Step 2: Form with role-specific fields
- Role-colored accents on selection

### Driver: Home Screen
- Header: Transparent, logo left, notification icon right
- Components: Status toggle, nearby job cards, earnings summary
- Use Helper blue (`#1E40AF`) for accents

### Business: Dashboard Screen
- Header: Transparent, company logo left, notification icon right
- Components: Active helpers count, quick action buttons (Post Job, Generate QR)
- Use Requester green (`#059669`) for accents

## 6. Visual Design

### Buttons
- Primary: Solid fill `#1E40AF`, white text, 12px radius
- Secondary: White fill, `#1E40AF` border, colored text
- Ghost: Transparent, colored text only
- All buttons: 52px height, `activeOpacity: 0.7`

### Cards
- Background: White
- Border radius: 16px
- Border: 1px solid `#E5E7EB`
- Padding: 16-20px
- No shadow (use background color for elevation)

### Status Badges
- Rounded pills (full radius)
- Colored backgrounds with matching text
- Padding: 4px 12px

### Icons
- Feather icons from @expo/vector-icons
- Size: 20-24px
- Color: Match context (gray for inactive, colored for active)

### Inputs
- Height: 48px
- Border: 1px solid `#E5E7EB`
- Border radius: 8px
- Focus: 2px `#1E40AF` ring

## 7. Spacing System

Based on 4px grid:
- xs: 4px
- sm: 8px
- md: 12px
- lg: 16px
- xl: 20px
- 2xl: 24px
- 3xl: 32px
- 4xl: 40px
- 5xl: 48px

## 8. Assets

### Required Images
1. **App Icon**: Blue abstract connection/handshake symbol
2. **Splash Screen**: Centered logo on white background
3. **Empty States**: Minimal line art illustrations with brand colors

### Image Style
- Minimal, clean design
- Use brand colors (blue/green accents)
- Professional tone, avoid clipart style
