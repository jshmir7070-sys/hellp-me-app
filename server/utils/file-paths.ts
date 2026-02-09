/**
 * 파일 저장 경로/접근 정책 분리 (T-36)
 * 
 * PII/증빙/공개 파일 분리 저장:
 * - /private/identity: 신분증, 면허증 등 개인정보
 * - /private/proof: 업무 증빙 사진
 * - /public/assets: 공개 가능한 이미지
 */

export const FILE_PATHS = {
  PRIVATE: {
    IDENTITY: ".private/identity",
    PROOF: ".private/proof",
    DOCUMENTS: ".private/documents",
    SETTLEMENTS: ".private/settlements",
  },
  PUBLIC: {
    ASSETS: "public/assets",
    REGION_MAPS: "public/region-maps",
    GUIDES: "public/guides",
  },
} as const;

export const FILE_ACCESS_POLICY = {
  PRIVATE_IDENTITY: {
    path: FILE_PATHS.PRIVATE.IDENTITY,
    accessLevel: "owner_and_admin",
    retentionDays: 730,
    encryption: true,
    description: "신분증, 면허증 등 개인정보 문서",
  },
  PRIVATE_PROOF: {
    path: FILE_PATHS.PRIVATE.PROOF,
    accessLevel: "owner_and_admin",
    retentionDays: 365,
    encryption: false,
    description: "업무 증빙 사진 (출퇴근, 배송 완료 등)",
  },
  PRIVATE_DOCUMENTS: {
    path: FILE_PATHS.PRIVATE.DOCUMENTS,
    accessLevel: "admin_only",
    retentionDays: 730,
    encryption: true,
    description: "계약서, 정산서 등 법적 문서",
  },
  PRIVATE_SETTLEMENTS: {
    path: FILE_PATHS.PRIVATE.SETTLEMENTS,
    accessLevel: "owner_and_admin",
    retentionDays: 1825,
    encryption: false,
    description: "정산 명세서 (5년 보관)",
  },
  PUBLIC_ASSETS: {
    path: FILE_PATHS.PUBLIC.ASSETS,
    accessLevel: "public",
    retentionDays: null,
    encryption: false,
    description: "공개 이미지 (로고, 아이콘 등)",
  },
  PUBLIC_REGION_MAPS: {
    path: FILE_PATHS.PUBLIC.REGION_MAPS,
    accessLevel: "authenticated",
    retentionDays: null,
    encryption: false,
    description: "지역 지도 이미지",
  },
  PUBLIC_GUIDES: {
    path: FILE_PATHS.PUBLIC.GUIDES,
    accessLevel: "authenticated",
    retentionDays: null,
    encryption: false,
    description: "배송 가이드 문서",
  },
} as const;

export type AccessLevel = "public" | "authenticated" | "owner_only" | "owner_and_admin" | "admin_only";

export interface FilePathInfo {
  basePath: string;
  accessLevel: AccessLevel;
  retentionDays: number | null;
}

/**
 * 파일 유형에 따른 저장 경로 결정
 */
export function getFilePath(fileType: string): FilePathInfo {
  switch (fileType) {
    case "driver_license":
    case "cargo_license":
    case "id_document":
    case "identity":
      return {
        basePath: FILE_PATHS.PRIVATE.IDENTITY,
        accessLevel: "owner_and_admin",
        retentionDays: 730,
      };
      
    case "work_proof":
    case "check_in_photo":
    case "check_out_photo":
    case "delivery_proof":
      return {
        basePath: FILE_PATHS.PRIVATE.PROOF,
        accessLevel: "owner_and_admin",
        retentionDays: 365,
      };
      
    case "contract":
    case "agreement":
    case "legal_document":
      return {
        basePath: FILE_PATHS.PRIVATE.DOCUMENTS,
        accessLevel: "admin_only",
        retentionDays: 730,
      };
      
    case "settlement":
    case "settlement_statement":
      return {
        basePath: FILE_PATHS.PRIVATE.SETTLEMENTS,
        accessLevel: "owner_and_admin",
        retentionDays: 1825,
      };
      
    case "region_map":
      return {
        basePath: FILE_PATHS.PUBLIC.REGION_MAPS,
        accessLevel: "authenticated",
        retentionDays: null,
      };
      
    case "delivery_guide":
      return {
        basePath: FILE_PATHS.PUBLIC.GUIDES,
        accessLevel: "authenticated",
        retentionDays: null,
      };
      
    case "public_asset":
    case "logo":
    case "icon":
    default:
      return {
        basePath: FILE_PATHS.PUBLIC.ASSETS,
        accessLevel: "public",
        retentionDays: null,
      };
  }
}

/**
 * 사용자가 파일에 접근 가능한지 확인
 */
export function canAccessFile(
  accessLevel: AccessLevel,
  userId?: string,
  fileOwnerId?: string,
  isAdmin: boolean = false
): boolean {
  switch (accessLevel) {
    case "public":
      return true;
      
    case "authenticated":
      return !!userId;
      
    case "owner_only":
      return userId === fileOwnerId;
      
    case "owner_and_admin":
      return isAdmin || userId === fileOwnerId;
      
    case "admin_only":
      return isAdmin;
      
    default:
      return false;
  }
}

/**
 * 파일 전체 경로 생성
 */
export function buildFilePath(fileType: string, userId: string, filename: string): string {
  const { basePath } = getFilePath(fileType);
  const datePath = new Date().toISOString().slice(0, 10).replace(/-/g, "/");
  return `${basePath}/${userId}/${datePath}/${filename}`;
}

/**
 * 파일 접근 정책 문서
 */
export const FILE_PATH_POLICY = {
  description: `
    === 파일 저장 경로/접근 정책 ===
    
    1. 비공개 파일 (/private)
       - identity/: 신분증, 면허증 (2년 보관, 암호화)
       - proof/: 업무 증빙 사진 (1년 보관)
       - documents/: 계약서, 법적 문서 (2년 보관, 암호화)
       - settlements/: 정산 명세서 (5년 보관)
    
    2. 공개 파일 (/public)
       - assets/: 로고, 아이콘 등 공개 이미지
       - region-maps/: 지역 지도 (인증 사용자)
       - guides/: 배송 가이드 (인증 사용자)
    
    3. 접근 권한 수준
       - public: 모든 사용자
       - authenticated: 로그인 사용자
       - owner_only: 파일 소유자만
       - owner_and_admin: 소유자 + 관리자
       - admin_only: 관리자만
  `,
};
