import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface SettingField {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'email' | 'tel' | 'url' | 'textarea';
  description?: string;
}

const SETTING_GROUPS: {
  title: string;
  description: string;
  icon: string;
  fields: SettingField[];
}[] = [
  {
    title: '사업자 정보',
    description: '세금계산서 발행에 사용되는 플랫폼 사업자 정보',
    icon: '🏢',
    fields: [
      { key: 'platform_corp_num', label: '사업자등록번호', placeholder: '000-00-00000', description: '하이픈(-) 포함 또는 10자리 숫자' },
      { key: 'platform_corp_name', label: '상호 (법인명)', placeholder: '헬프미' },
      { key: 'platform_ceo_name', label: '대표자명', placeholder: '홍길동' },
      { key: 'platform_addr', label: '사업장 주소', placeholder: '서울특별시 강남구...' },
      { key: 'platform_biz_type', label: '업태', placeholder: '서비스업' },
      { key: 'platform_biz_class', label: '종목', placeholder: '물류대행' },
    ],
  },
  {
    title: '통신판매업 정보',
    description: '전자상거래 관련 등록 정보',
    icon: '📋',
    fields: [
      { key: 'platform_ecommerce_reg_num', label: '통신판매업 신고번호', placeholder: '제2024-서울강남-00000호' },
      { key: 'platform_ecommerce_reg_authority', label: '신고 기관', placeholder: '서울특별시 강남구청' },
    ],
  },
  {
    title: '연락처 정보',
    description: '고객 및 파트너 연락용 정보',
    icon: '📞',
    fields: [
      { key: 'platform_email', label: '대표 이메일', placeholder: 'info@hellpme.kr', type: 'email' },
      { key: 'platform_phone', label: '대표 전화번호', placeholder: '02-0000-0000', type: 'tel' },
      { key: 'platform_fax', label: '팩스번호', placeholder: '02-0000-0001', type: 'tel' },
    ],
  },
  {
    title: 'CS (고객지원)',
    description: '고객 상담 및 지원 채널 정보',
    icon: '🎧',
    fields: [
      { key: 'cs_phone', label: 'CS 전화번호', placeholder: '1588-0000', type: 'tel' },
      { key: 'cs_email', label: 'CS 이메일', placeholder: 'cs@hellpme.kr', type: 'email' },
      { key: 'cs_manager_name', label: 'CS 담당자명', placeholder: '김담당' },
      { key: 'cs_operating_hours', label: '상담 운영시간', placeholder: '평일 09:00 ~ 18:00 (공휴일 휴무)' },
    ],
  },
  {
    title: '카카오톡 / SNS',
    description: '카카오톡 채널 및 소셜 미디어 정보',
    icon: '💬',
    fields: [
      { key: 'kakao_channel_id', label: '카카오톡 채널 ID', placeholder: '@hellpme' },
      { key: 'kakao_channel_url', label: '카카오톡 채널 URL', placeholder: 'https://pf.kakao.com/_xxxxx', type: 'url' },
      { key: 'instagram_url', label: '인스타그램 URL', placeholder: 'https://instagram.com/hellpme', type: 'url' },
      { key: 'blog_url', label: '블로그/홈페이지 URL', placeholder: 'https://hellpme.kr', type: 'url' },
    ],
  },
  {
    title: '앱 표시 정보',
    description: '앱 하단, 약관 등에 노출되는 정보',
    icon: '📱',
    fields: [
      { key: 'app_footer_text', label: '앱 하단 표시 텍스트', placeholder: '(주)헬프미 | 대표: 홍길동 | 사업자번호: 000-00-00000', type: 'textarea' },
      { key: 'privacy_policy_url', label: '개인정보처리방침 URL', placeholder: 'https://hellpme.kr/privacy', type: 'url' },
      { key: 'terms_of_service_url', label: '이용약관 URL', placeholder: 'https://hellpme.kr/terms', type: 'url' },
    ],
  },
];

export default function PlatformSettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'SUPER_ADMIN';

  // 슈퍼관리자가 아니면 접근 차단
  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-6xl">🔒</div>
        <h2 className="text-xl font-bold text-gray-700">접근 권한이 없습니다</h2>
        <p className="text-gray-500">플랫폼 설정은 슈퍼관리자만 변경할 수 있습니다.</p>
      </div>
    );
  }

  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const res = await adminFetch('/api/admin/system-settings', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    },
  });

  useEffect(() => {
    if (settings) {
      setFormValues(settings);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await adminFetch('/api/admin/system-settings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error('Failed to save setting');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
    },
  });

  const handleChange = (key: string, value: string) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSaveAll = async () => {
    const allKeys = SETTING_GROUPS.flatMap(g => g.fields.map(f => f.key));
    let savedCount = 0;

    for (const key of allKeys) {
      const currentVal = formValues[key] || '';
      const originalVal = settings?.[key] || '';
      if (currentVal !== originalVal) {
        setSavingKey(key);
        try {
          await saveMutation.mutateAsync({ key, value: currentVal });
          savedCount++;
        } catch {
          toast({
            title: '저장 실패',
            description: `${key} 설정 저장에 실패했습니다.`,
            variant: 'error',
          });
        }
      }
    }

    setSavingKey(null);
    setHasChanges(false);

    if (savedCount > 0) {
      toast({
        title: '저장 완료',
        description: `${savedCount}개 설정이 저장되었습니다.`,
        variant: 'success',
      });
    } else {
      toast({
        title: '변경 없음',
        description: '변경된 설정이 없습니다.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">플랫폼 설정</h1>
          <p className="text-muted-foreground">사업자 정보, CS 연락처, 카카오톡 채널 등 플랫폼 기본 정보 관리</p>
        </div>
        <button
          onClick={handleSaveAll}
          disabled={!hasChanges || saveMutation.isPending}
          className={`px-6 py-2.5 rounded-lg font-medium text-white transition-all ${
            hasChanges
              ? 'bg-blue-600 hover:bg-blue-700 shadow-md'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {saveMutation.isPending ? '저장 중...' : '전체 저장'}
        </button>
      </div>

      {SETTING_GROUPS.map((group) => (
        <div key={group.title} className="bg-white rounded-lg border overflow-hidden">
          <div className="border-b bg-gray-50 px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{group.icon}</span>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{group.title}</h2>
                <p className="text-sm text-gray-500">{group.description}</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid gap-5 md:grid-cols-2">
              {group.fields.map((field) => {
                const isChanged = (formValues[field.key] || '') !== (settings?.[field.key] || '');
                return (
                  <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {field.label}
                      {isChanged && (
                        <span className="ml-2 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">변경됨</span>
                      )}
                    </label>
                    {field.description && (
                      <p className="text-xs text-gray-400 mb-1">{field.description}</p>
                    )}
                    {field.type === 'textarea' ? (
                      <textarea
                        value={formValues[field.key] || ''}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        rows={3}
                        className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${
                          isChanged ? 'border-amber-400 bg-amber-50/30' : 'border-gray-300'
                        } ${savingKey === field.key ? 'opacity-50' : ''}`}
                      />
                    ) : (
                      <input
                        type={field.type || 'text'}
                        value={formValues[field.key] || ''}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${
                          isChanged ? 'border-amber-400 bg-amber-50/30' : 'border-gray-300'
                        } ${savingKey === field.key ? 'opacity-50' : ''}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      {/* 현재 저장된 값 미리보기 */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="border-b bg-gray-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👁</span>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">앱 출력 미리보기</h2>
              <p className="text-sm text-gray-500">저장된 정보 기반 앱 하단/정보 출력 예시</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="bg-gray-50 rounded-lg p-6 space-y-3 text-sm text-gray-600">
            <div className="font-bold text-gray-900 text-base">
              {formValues['platform_corp_name'] || '(상호 미입력)'}
            </div>
            <div className="space-y-1">
              <div>대표: {formValues['platform_ceo_name'] || '-'}</div>
              <div>사업자등록번호: {formValues['platform_corp_num'] || '-'}</div>
              <div>통신판매업: {formValues['platform_ecommerce_reg_num'] || '-'}</div>
              <div>주소: {formValues['platform_addr'] || '-'}</div>
            </div>
            <div className="border-t pt-3 space-y-1">
              <div>전화: {formValues['platform_phone'] || '-'} | 팩스: {formValues['platform_fax'] || '-'}</div>
              <div>이메일: {formValues['platform_email'] || '-'}</div>
            </div>
            <div className="border-t pt-3 space-y-1">
              <div>CS 문의: {formValues['cs_phone'] || '-'} ({formValues['cs_operating_hours'] || '-'})</div>
              <div>CS 이메일: {formValues['cs_email'] || '-'} | 담당: {formValues['cs_manager_name'] || '-'}</div>
              {formValues['kakao_channel_id'] && (
                <div>카카오톡: {formValues['kakao_channel_id']}</div>
              )}
            </div>
            {formValues['app_footer_text'] && (
              <div className="border-t pt-3 text-xs text-gray-400">
                {formValues['app_footer_text']}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
