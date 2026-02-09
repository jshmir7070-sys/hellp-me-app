/**
 * 주소 검색 컴포넌트
 * - Daum Postcode API 사용
 * - 우편번호, 기본주소, 상세주소 입력
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search } from "lucide-react";

interface AddressData {
  zipCode: string;
  address: string;
  addressDetail: string;
}

interface AddressSearchProps {
  value: AddressData;
  onChange: (value: AddressData) => void;
  disabled?: boolean;
}

// Daum Postcode API 타입 정의
declare global {
  interface Window {
    daum: {
      Postcode: new (config: {
        oncomplete: (data: {
          zonecode: string;
          address: string;
          addressType: string;
          bname: string;
          buildingName: string;
        }) => void;
        width: string;
        height: string;
      }) => {
        embed: (element: HTMLElement | null) => void;
      };
    };
  }
}

export function AddressSearch({ value, onChange, disabled = false }: AddressSearchProps) {
  const [showPostcode, setShowPostcode] = React.useState(false);
  const postcodeRef = React.useRef<HTMLDivElement>(null);

  // Daum Postcode API 스크립트 로드
  React.useEffect(() => {
    if (showPostcode && !window.daum) {
      const script = document.createElement('script');
      script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
      script.async = true;
      document.head.appendChild(script);
    }
  }, [showPostcode]);

  // Postcode 검색 창 열기
  React.useEffect(() => {
    if (showPostcode && window.daum && postcodeRef.current) {
      const postcode = new window.daum.Postcode({
        oncomplete: (data) => {
          // 선택된 주소 정보 처리
          onChange({
            zipCode: data.zonecode,
            address: data.address,
            addressDetail: value.addressDetail, // 기존 상세주소 유지
          });
          setShowPostcode(false);
        },
        width: '100%',
        height: '100%',
      });
      postcode.embed(postcodeRef.current);
    }
  }, [showPostcode, value.addressDetail, onChange]);

  return (
    <div className="space-y-3">
      {/* 우편번호 + 검색 버튼 */}
      <div className="flex gap-2">
        <div className="flex-1 space-y-2">
          <Label>우편번호</Label>
          <Input
            value={value.zipCode}
            readOnly
            placeholder="우편번호"
            disabled={disabled}
          />
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowPostcode(true)}
            disabled={disabled}
          >
            <Search className="h-4 w-4 mr-2" />
            주소 검색
          </Button>
        </div>
      </div>

      {/* 기본 주소 */}
      <div className="space-y-2">
        <Label>기본 주소</Label>
        <Input
          value={value.address}
          readOnly
          placeholder="주소를 검색해주세요"
          disabled={disabled}
        />
      </div>

      {/* 상세 주소 */}
      <div className="space-y-2">
        <Label>상세 주소</Label>
        <Input
          value={value.addressDetail}
          onChange={(e) => onChange({ ...value, addressDetail: e.target.value })}
          placeholder="상세 주소를 입력하세요"
          disabled={disabled}
        />
      </div>

      {/* Daum Postcode 검색 모달 */}
      <Dialog open={showPostcode} onOpenChange={setShowPostcode}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>우편번호 검색</DialogTitle>
          </DialogHeader>
          <div ref={postcodeRef} style={{ height: '400px' }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
