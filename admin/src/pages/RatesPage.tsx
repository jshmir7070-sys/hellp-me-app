import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Check, X, ChevronUp, ChevronDown, RefreshCw, Download } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const PRICE_OPTIONS = [
  800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000,
  2100, 2200, 2300, 2400, 2500, 2600, 2700, 2800, 2900, 3000, 3500, 4000, 4500, 5000
];

const ETC_PRICE_OPTIONS = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

const MIN_TOTAL_OPTIONS = [
  100000, 150000, 200000, 250000, 300000, 350000, 400000, 450000, 500000
];

const RATE_OPTIONS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

interface CourierSetting {
  id: number;
  courierName: string;
  category: string;
  basePricePerBox: number;
  etcPricePerBox: number;
  minDeliveryFee: number;
  minTotal: number;
  commissionRate: number;
  urgentCommissionRate: number;
  urgentSurchargeRate: number;
  isDefault: boolean;
  isActive: boolean;
  sortOrder?: number;
}

const CATEGORY_TABS = [
  { value: 'parcel', label: '택배사' },
  { value: 'other', label: '기타택배' },
  { value: 'cold', label: '냉탑전용' },
] as const;

const MAIN_TABS = [
  { value: 'rates', label: '운임 정책' },
  { value: 'teams', label: '팀 수수료' },
  { value: 'deposit', label: '계약금/취소규정' },
] as const;

type MainTabType = 'rates' | 'teams' | 'deposit';
type CategoryType = 'parcel' | 'other' | 'cold';
type EditableFields = Partial<CourierSetting>;

interface TeamWithLeader {
  id: number;
  name: string;
  leaderId: string;
  businessType?: string;
  emergencyPhone?: string;
  commissionRate: number;
  isActive: boolean;
  leader?: {
    id: string;
    email: string;
    name: string;
    phone?: string;
  };
}

export default function RatesPage() {
  const [mainTab, setMainTab] = useState<MainTabType>('rates');
  const [activeCategory, setActiveCategory] = useState<CategoryType>('parcel');
  const [editingRows, setEditingRows] = useState<Record<number, EditableFields>>({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newRow, setNewRow] = useState<Partial<CourierSetting>>({
    courierName: '',
    category: 'parcel',
    basePricePerBox: 1200,
    etcPricePerBox: 0,
    minDeliveryFee: 1000,
    minTotal: 300000,
    commissionRate: 10,
    urgentCommissionRate: 12,
    urgentSurchargeRate: 15,
    isActive: true,
  });
  const [otherSettings, setOtherSettings] = useState({ destinationPrice: '', boxPrice: '', minDailyFee: '' });
  const [coldSettings, setColdSettings] = useState({ minDailyFee: '' });
  const [depositSettings, setDepositSettings] = useState({
    depositRate: '10',
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: couriers = [], isLoading } = useQuery<CourierSetting[]>({
    queryKey: ['/api/admin/settings/couriers'],
    queryFn: async () => {
      const res = await adminFetch('/api/admin/settings/couriers');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const { data: systemSettings = [] } = useQuery<{ settingKey: string; settingValue: string }[]>({
    queryKey: ['/api/admin/settings/system'],
    queryFn: async () => {
      const res = await adminFetch('/api/admin/settings/system');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: teams = [], isLoading: teamsLoading, refetch: refetchTeams } = useQuery<TeamWithLeader[]>({
    queryKey: ['/api/admin/teams'],
    queryFn: async () => {
      const res = await adminFetch('/api/admin/teams');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: mainTab === 'teams',
  });

  const { data: helpers = [] } = useQuery<{ id: string; email: string; name: string; phone?: string }[]>({
    queryKey: ['/api/admin/helpers-for-team'],
    queryFn: async () => {
      const res = await adminFetch('/api/admin/users?role=helper');
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.users || []);
    },
    enabled: mainTab === 'teams',
  });

  const [editingTeam, setEditingTeam] = useState<number | null>(null);
  const [teamFormData, setTeamFormData] = useState<Partial<TeamWithLeader>>({});
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [newTeamData, setNewTeamData] = useState<Partial<TeamWithLeader>>({ name: '', businessType: '', emergencyPhone: '', commissionRate: 0 });
  const [selectedLeaderId, setSelectedLeaderId] = useState<string>('');

  const updateTeamMutation = useMutation({
    mutationFn: async ({ teamId, data }: { teamId: number; data: Partial<TeamWithLeader> }) => {
      const res = await adminFetch(`/api/admin/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/teams'] });
      setEditingTeam(null);
      toast({ title: '팀 정보가 수정되었습니다.' });
    },
    onError: () => {
      toast({ title: '수정 실패', variant: 'destructive' });
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: { name: string; leaderId: string; businessType?: string; emergencyPhone?: string; commissionRate?: number }) => {
      const res = await adminFetch('/api/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/teams'] });
      setIsAddingTeam(false);
      setNewTeamData({ name: '', businessType: '', emergencyPhone: '', commissionRate: 0 });
      setSelectedLeaderId('');
      toast({ title: '팀이 생성되었습니다.' });
    },
    onError: () => {
      toast({ title: '생성 실패', variant: 'destructive' });
    },
  });

  // Load system settings into state
  React.useEffect(() => {
    if (systemSettings.length > 0) {
      const destPrice = systemSettings.find(s => s.settingKey === 'other_destination_price');
      const boxPrice = systemSettings.find(s => s.settingKey === 'other_box_price');
      const otherMinFee = systemSettings.find(s => s.settingKey === 'other_min_daily_fee');
      const coldMinFee = systemSettings.find(s => s.settingKey === 'cold_min_daily_fee');
      setOtherSettings({
        destinationPrice: destPrice?.settingValue || '1800',
        boxPrice: boxPrice?.settingValue || '1500',
        minDailyFee: otherMinFee?.settingValue || '50000',
      });
      setColdSettings({
        minDailyFee: coldMinFee?.settingValue || '100000',
      });
      const depRate = systemSettings.find(s => s.settingKey === 'deposit_rate');
      setDepositSettings({
        depositRate: depRate?.settingValue || '10',
      });
    }
  }, [systemSettings]);

  const saveSystemSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await adminFetch('/api/admin/settings/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settingKey: key, settingValue: value }),
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings/system'] });
    },
  });

  const saveOtherSettings = async () => {
    if (!window.confirm('기타택배 설정을 저장하시겠습니까?')) return;
    try {
      await Promise.all([
        saveSystemSettingMutation.mutateAsync({ key: 'other_destination_price', value: otherSettings.destinationPrice }),
        saveSystemSettingMutation.mutateAsync({ key: 'other_box_price', value: otherSettings.boxPrice }),
        saveSystemSettingMutation.mutateAsync({ key: 'other_min_daily_fee', value: otherSettings.minDailyFee }),
      ]);
      window.alert('기타택배 설정이 저장되었습니다.');
    } catch {
      toast({ title: '저장 실패', variant: 'destructive' });
    }
  };

  const saveColdSettings = async () => {
    if (!window.confirm('냉탑전용 설정을 저장하시겠습니까?')) return;
    try {
      await saveSystemSettingMutation.mutateAsync({ key: 'cold_min_daily_fee', value: coldSettings.minDailyFee });
      window.alert('냉탑전용 설정이 저장되었습니다.');
    } catch {
      toast({ title: '저장 실패', variant: 'destructive' });
    }
  };

  const saveDepositSettings = async () => {
    if (!window.confirm('계약금 설정을 저장하시겠습니까?')) return;
    try {
      await saveSystemSettingMutation.mutateAsync({ key: 'deposit_rate', value: depositSettings.depositRate });
      window.alert('계약금 설정이 저장되었습니다.');
    } catch {
      toast({ title: '저장 실패', variant: 'destructive' });
    }
  };

  // 현재 탭의 택배사만 필터링 (카테고리 기본값 제외)
  const courierList = couriers
    .filter(c => !c.courierName.startsWith('(DEFAULT)') && c.category === activeCategory)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.id - b.id);

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CourierSetting> }) => {
      const res = await adminFetch(`/api/admin/settings/couriers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || '저장에 실패했습니다.');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings/couriers'] });
      window.alert('저장하였습니다.');
    },
    onError: (err: Error) => {
      toast({ title: '저장 실패', description: err.message, variant: 'destructive' });
      if (err.message.includes('세션')) {
        window.location.href = '/admin';
      }
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: Partial<CourierSetting>) => {
      const res = await adminFetch('/api/admin/settings/couriers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to add');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '택배사 추가 완료' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings/couriers'] });
      setIsAddingNew(false);
      setNewRow({
        courierName: '',
        category: activeCategory,
        basePricePerBox: activeCategory === 'other' ? 1800 : 1200,
        minDeliveryFee: 1000,
        minTotal: 300000,
        commissionRate: 10,
        urgentCommissionRate: 12,
        urgentSurchargeRate: 15,
        isActive: true,
      });
    },
    onError: (err: Error) => {
      toast({ title: '추가 실패', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await adminFetch(`/api/admin/settings/couriers/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || '삭제에 실패했습니다.');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '삭제 완료', description: 'DB에 반영되었습니다.' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settings/couriers'] });
    },
    onError: (err: Error) => {
      toast({ title: '삭제 실패', description: err.message, variant: 'destructive' });
      if (err.message.includes('세션')) {
        window.location.href = '/admin';
      }
    },
  });

  const roundTo100 = (value: number): number => Math.round(value / 100) * 100;

  const saveEdit = (id: number) => {
    const changes = editingRows[id];
    if (changes) {
      if (!window.confirm('변경사항을 저장하시겠습니까?')) return;
      updateMutation.mutate({ id, data: changes }, {
        onSuccess: () => {
          setEditingRows(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }
      });
    }
  };

  const updateField = (id: number, field: keyof CourierSetting, value: any) => {
    let finalValue = value;
    if (field === 'basePricePerBox' || field === 'minDeliveryFee' || field === 'minTotal') {
      finalValue = roundTo100(Number(value));
    }
    setEditingRows(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: finalValue }
    }));
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= courierList.length) return;

    const current = courierList[index];
    const target = courierList[targetIndex];

    const currentOrder = current.sortOrder ?? index;
    const targetOrder = target.sortOrder ?? targetIndex;

    updateMutation.mutate({ id: current.id, data: { sortOrder: targetOrder } });
    updateMutation.mutate({ id: target.id, data: { sortOrder: currentOrder } });
  };

  const getOptionsForField = (field: keyof CourierSetting): number[] => {
    switch (field) {
      case 'basePricePerBox':
      case 'minDeliveryFee':
        return PRICE_OPTIONS;
      case 'etcPricePerBox':
        return ETC_PRICE_OPTIONS;
      case 'minTotal':
        return MIN_TOTAL_OPTIONS;
      case 'commissionRate':
      case 'urgentCommissionRate':
      case 'urgentSurchargeRate':
        return RATE_OPTIONS;
      default:
        return [];
    }
  };

  const renderCell = (
    courier: CourierSetting,
    field: keyof CourierSetting,
    type: 'text' | 'number' | 'switch' | 'select' = 'text',
    _suffix: string = '',
    width: string = 'w-24'
  ) => {
    const value = editingRows[courier.id]?.[field] ?? courier[field];

    if (type === 'switch') {
      return (
        <Switch
          checked={value as boolean}
          onCheckedChange={(v) => updateField(courier.id, field, v)}
          className="scale-75"
        />
      );
    }

    if (type === 'select') {
      const options = getOptionsForField(field);
      const isRate = field === 'commissionRate' || field === 'urgentCommissionRate' || field === 'urgentSurchargeRate';
      const isMinTotal = field === 'minTotal';
      
      return (
        <Select
          value={String(value)}
          onValueChange={(v) => updateField(courier.id, field, Number(v))}
        >
          <SelectTrigger className={`h-7 ${width} text-xs bg-white border-gray-300`}>
            <SelectValue>
              {isMinTotal 
                ? `${(Number(value) / 10000).toFixed(0)}만` 
                : isRate 
                  ? `${value}%` 
                  : Number(value).toLocaleString()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[200px]">
            {options.map(opt => (
              <SelectItem key={opt} value={String(opt)} className="text-xs">
                {isMinTotal 
                  ? `${(opt / 10000).toFixed(0)}만원` 
                  : isRate 
                    ? `${opt}%` 
                    : `${opt.toLocaleString()}원`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return (
      <Input
        type={type}
        value={value as string | number}
        onChange={(e) => updateField(courier.id, field, type === 'number' ? Number(e.target.value) : e.target.value)}
        onBlur={(e) => {
          if ((field === 'basePricePerBox' || field === 'minDeliveryFee' || field === 'minTotal') && type === 'number') {
            updateField(courier.id, field, roundTo100(Number(e.target.value)));
          }
        }}
        step={field === 'basePricePerBox' || field === 'minDeliveryFee' || field === 'minTotal' ? 100 : 1}
        className={`h-7 ${width} text-xs text-right bg-white text-gray-900 border-gray-300`}
      />
    );
  };

  const updateNewField = (field: keyof CourierSetting, value: any) => {
    let finalValue = value;
    if (field === 'basePricePerBox' || field === 'minDeliveryFee' || field === 'minTotal') {
      finalValue = roundTo100(Number(value));
    }
    setNewRow(prev => ({ ...prev, [field]: finalValue }));
  };

  const renderNewCell = (
    field: keyof CourierSetting,
    type: 'text' | 'number' | 'switch' = 'text',
    width: string = 'w-20'
  ) => {
    const value = newRow[field];

    if (type === 'switch') {
      return (
        <Switch
          checked={value as boolean}
          onCheckedChange={(v) => updateNewField(field, v)}
          className="scale-75"
        />
      );
    }

    return (
      <Input
        type={type}
        value={value as string | number}
        onChange={(e) => setNewRow(prev => ({ 
          ...prev, 
          [field]: type === 'number' ? Number(e.target.value) : e.target.value 
        }))}
        onBlur={(e) => {
          if ((field === 'basePricePerBox' || field === 'minDeliveryFee' || field === 'minTotal') && type === 'number') {
            updateNewField(field, roundTo100(Number(e.target.value)));
          }
        }}
        step={field === 'basePricePerBox' || field === 'minDeliveryFee' || field === 'minTotal' ? 100 : 1}
        className={`h-7 ${width} text-xs ${type === 'number' ? 'text-right' : ''}`}
        placeholder={field === 'courierName' ? '택배사명' : ''}
      />
    );
  };

  const handleTabChange = (category: CategoryType) => {
    setActiveCategory(category);
    setIsAddingNew(false);
    setEditingRows({});
    // 새 행의 카테고리와 기본값 업데이트
    setNewRow({
      courierName: '',
      category: category,
      basePricePerBox: category === 'other' ? 1800 : 1200,
      minDeliveryFee: 1000,
      minTotal: 300000,
      commissionRate: 10,
      urgentCommissionRate: 12,
      urgentSurchargeRate: 15,
      isActive: true,
    });
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/settings/couriers'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/settings/system'] });
    toast({ title: '데이터를 새로고침했습니다.' });
  };

  const handleDownloadExcel = () => {
    const data = courierList.map(c => ({
      '택배사명': c.courierName,
      '카테고리': c.category === 'parcel' ? '택배사' : c.category === 'other' ? '기타택배' : '냉탑전용',
      '박스단가': c.basePricePerBox,
      '기타단가': c.etcPricePerBox,
      '최저총액': c.minTotal,
      '수수료율': c.commissionRate,
      '긴급수수료': c.urgentCommissionRate,
      '할증율': c.urgentSurchargeRate,
      '활성': c.isActive ? 'Y' : 'N',
    }));
    
    const headers = Object.keys(data[0] || {});
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => row[h as keyof typeof row]).join(','))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `운임설정_${activeCategory}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">운임/정책 설정</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={mainTab === 'rates' ? handleRefresh : () => refetchTeams()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            새로고침
          </Button>
          {mainTab === 'rates' && (
            <Button variant="outline" size="sm" onClick={handleDownloadExcel} disabled={courierList.length === 0}>
              <Download className="h-4 w-4 mr-1" />
              다운로드
            </Button>
          )}
          {mainTab === 'rates' && <p className="text-xs text-muted-foreground ml-2">* 단가는 공급가액 기준, 100원 단위</p>}
        </div>
      </div>

      {/* 상위 탭: 운임 정책 / 팀 수수료 */}
      <div className="flex border-b mb-4">
        {MAIN_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setMainTab(tab.value)}
            className={cn(
              'px-6 py-3 text-sm font-medium transition-colors relative',
              mainTab === tab.value
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 팀 수수료 섹션 */}
      {mainTab === 'teams' && (
        <Card>
          <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm">팀 수수료 설정</CardTitle>
              <CardDescription className="text-xs">
                팀장별 수수료율 설정 (부가세 포함가)
              </CardDescription>
            </div>
            {!isAddingTeam && (
              <Button onClick={() => setIsAddingTeam(true)} size="sm" className="h-7 text-xs">
                <Plus className="h-3 w-3 mr-1" />
                팀 추가
              </Button>
            )}
          </CardHeader>
          <CardContent className="py-2">
            {teamsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="excel-table-wrapper">
                <div className="excel-table-scroll">
                  <table className="excel-table" style={{ width: '100%' }}>
                    <colgroup>
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '20%' }} />
                    </colgroup>
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-1.5 font-medium">팀장 아이디 (이메일)</th>
                        <th className="text-left p-1.5 font-medium">업무</th>
                        <th className="text-left p-1.5 font-medium">긴급전화번호</th>
                        <th className="text-left p-1.5 font-medium">팀명</th>
                        <th className="text-right p-1.5 font-medium">수수료 (%)</th>
                        <th className="text-center p-1.5 font-medium">액션</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* 새 팀 추가 행 */}
                      {isAddingTeam && (
                        <tr className="border-t bg-green-50">
                          <td className="p-1.5">
                            <Select value={selectedLeaderId} onValueChange={setSelectedLeaderId}>
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="헬퍼 선택" />
                              </SelectTrigger>
                              <SelectContent>
                                {helpers.map(h => (
                                  <SelectItem key={h.id} value={h.id}>{h.email} ({h.name})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-1.5">
                            <Input
                              className="h-7 text-xs"
                              value={newTeamData.businessType || ''}
                              onChange={(e) => setNewTeamData({ ...newTeamData, businessType: e.target.value })}
                              placeholder="업무"
                            />
                          </td>
                          <td className="p-1.5">
                            <Input
                              className="h-7 text-xs"
                              value={newTeamData.emergencyPhone || ''}
                              onChange={(e) => setNewTeamData({ ...newTeamData, emergencyPhone: e.target.value })}
                              placeholder="010-0000-0000"
                            />
                          </td>
                          <td className="p-1.5">
                            <Input
                              className="h-7 text-xs"
                              value={newTeamData.name || ''}
                              onChange={(e) => setNewTeamData({ ...newTeamData, name: e.target.value })}
                              placeholder="팀명"
                            />
                          </td>
                          <td className="p-1.5">
                            <Input
                              type="number"
                              className="h-7 text-xs w-16 text-right"
                              value={newTeamData.commissionRate || 0}
                              onChange={(e) => setNewTeamData({ ...newTeamData, commissionRate: Number(e.target.value) })}
                              min={0}
                              max={15}
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <div className="flex gap-0.5 justify-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (!selectedLeaderId || !newTeamData.name?.trim()) {
                                    toast({ title: '팀장과 팀명을 입력하세요', variant: 'destructive' });
                                    return;
                                  }
                                  createTeamMutation.mutate({
                                    name: newTeamData.name,
                                    leaderId: selectedLeaderId,
                                    businessType: newTeamData.businessType,
                                    emergencyPhone: newTeamData.emergencyPhone,
                                    commissionRate: newTeamData.commissionRate,
                                  });
                                }}
                                disabled={createTeamMutation.isPending}
                                className="h-6 w-6 p-0"
                              >
                                <Check className="h-3 w-3 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setIsAddingTeam(false)}
                                className="h-6 w-6 p-0"
                              >
                                <X className="h-3 w-3 text-red-600" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                      {teams.map((team) => (
                        <tr key={team.id} className="border-t hover:bg-muted/30">
                          <td className="p-1.5 text-xs">{team.leader?.email || team.leaderId}</td>
                          <td className="p-1.5">
                            {editingTeam === team.id ? (
                              <Input
                                className="h-7 text-xs"
                                value={teamFormData.businessType ?? team.businessType ?? ''}
                                onChange={(e) => setTeamFormData({ ...teamFormData, businessType: e.target.value })}
                              />
                            ) : (
                              <span className="text-xs">{team.businessType || '-'}</span>
                            )}
                          </td>
                          <td className="p-1.5">
                            {editingTeam === team.id ? (
                              <Input
                                className="h-7 text-xs"
                                value={teamFormData.emergencyPhone ?? team.emergencyPhone ?? ''}
                                onChange={(e) => setTeamFormData({ ...teamFormData, emergencyPhone: e.target.value })}
                              />
                            ) : (
                              <span className="text-xs">{team.emergencyPhone || '-'}</span>
                            )}
                          </td>
                          <td className="p-1.5">
                            {editingTeam === team.id ? (
                              <Input
                                className="h-7 text-xs"
                                value={teamFormData.name ?? team.name ?? ''}
                                onChange={(e) => setTeamFormData({ ...teamFormData, name: e.target.value })}
                              />
                            ) : (
                              <span className="text-xs font-medium">{team.name}</span>
                            )}
                          </td>
                          <td className="p-1.5 text-right">
                            {editingTeam === team.id ? (
                              <Input
                                type="number"
                                className="h-7 text-xs w-16 text-right"
                                value={teamFormData.commissionRate ?? team.commissionRate ?? 0}
                                onChange={(e) => setTeamFormData({ ...teamFormData, commissionRate: Number(e.target.value) })}
                                min={0}
                                max={15}
                              />
                            ) : (
                              <span className="text-xs">{team.commissionRate || 0}%</span>
                            )}
                          </td>
                          <td className="p-1.5 text-center">
                            {editingTeam === team.id ? (
                              <div className="flex gap-0.5 justify-center">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    updateTeamMutation.mutate({ teamId: team.id, data: teamFormData });
                                  }}
                                  disabled={updateTeamMutation.isPending}
                                  className="h-6 w-6 p-0"
                                >
                                  <Check className="h-3 w-3 text-green-600" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingTeam(null);
                                    setTeamFormData({});
                                  }}
                                  className="h-6 w-6 p-0"
                                >
                                  <X className="h-3 w-3 text-red-600" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingTeam(team.id);
                                  setTeamFormData({
                                    name: team.name,
                                    businessType: team.businessType,
                                    emergencyPhone: team.emergencyPhone,
                                    commissionRate: team.commissionRate,
                                  });
                                }}
                                className="h-6 px-2 text-xs"
                              >
                                수정
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {teams.length === 0 && !isAddingTeam && (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-muted-foreground text-sm">
                            등록된 팀이 없습니다. 팀을 추가해주세요.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="mt-4 p-3 bg-blue-50 rounded text-xs text-blue-700">
              <p className="font-medium mb-1">수수료 계산 방식:</p>
              <p>본사 수수료가 12%, 팀장 수수료가 5%인 경우:</p>
              <p>→ 본사 실수입: 12% - 5% = 7%</p>
              <p>→ 팀장 수입: 5%</p>
              <p>→ 합계: 12% (부가세 포함)</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 운임 정책 섹션 */}
      {mainTab === 'rates' && (
        <>
      {/* 카테고리 탭 */}
      <div className="flex border-b">
        {CATEGORY_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={cn(
              'px-6 py-3 text-sm font-medium transition-colors relative',
              activeCategory === tab.value
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
            <span className="ml-2 text-xs text-muted-foreground">
              ({couriers.filter(c => !c.courierName.startsWith('(DEFAULT)') && c.category === tab.value).length})
            </span>
          </button>
        ))}
      </div>

      {/* 택배사 목록 (parcel) 또는 단일 가격 설정 (other, cold) */}
      {activeCategory === 'parcel' ? (
        <Card>
          <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm">택배사 설정</CardTitle>
              <CardDescription className="text-xs">
                값 변경 후 저장 클릭, 화살표로 순서 변경
              </CardDescription>
            </div>
            {!isAddingNew && (
              <Button onClick={() => setIsAddingNew(true)} size="sm" className="h-7 text-xs">
                <Plus className="h-3 w-3 mr-1" />
                추가
              </Button>
            )}
          </CardHeader>
          <CardContent className="py-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="excel-table-wrapper">
                <div className="excel-table-scroll">
                <table className="excel-table" style={{ width: '100%' }}>
                  <colgroup>
                    <col style={{ width: '4%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '16%' }} />
                  </colgroup>
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-1.5 text-center">#</th>
                      <th className="text-left p-1.5 font-medium">택배사명</th>
                      <th className="text-right p-1.5 font-medium">단가</th>
                      <th className="text-right p-1.5 font-medium">기타</th>
                      <th className="text-right p-1.5 font-medium">최저총액</th>
                      <th className="text-right p-1.5 font-medium">수수료</th>
                      <th className="text-right p-1.5 font-medium">긴급</th>
                      <th className="text-right p-1.5 font-medium">할증</th>
                      <th className="text-center p-1.5 font-medium">활성</th>
                      <th className="text-center p-1.5 font-medium">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 새 택배사 추가 행 */}
                    {isAddingNew && (
                      <tr className="border-t bg-green-50">
                        <td className="p-1.5 text-center text-muted-foreground">-</td>
                        <td className="p-1.5">{renderNewCell('courierName', 'text', 'w-full')}</td>
                        <td className="p-1.5">{renderNewCell('basePricePerBox', 'number', 'w-12')}</td>
                        <td className="p-1.5">{renderNewCell('etcPricePerBox', 'number', 'w-12')}</td>
                        <td className="p-1.5">{renderNewCell('minTotal', 'number', 'w-14')}</td>
                        <td className="p-1.5">{renderNewCell('commissionRate', 'number', 'w-10')}</td>
                        <td className="p-1.5">{renderNewCell('urgentCommissionRate', 'number', 'w-10')}</td>
                        <td className="p-1.5">{renderNewCell('urgentSurchargeRate', 'number', 'w-10')}</td>
                        <td className="p-1.5 text-center">{renderNewCell('isActive', 'switch')}</td>
                        <td className="p-1.5 text-center">
                          <div className="flex gap-0.5 justify-center">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => addMutation.mutate({ ...newRow, category: activeCategory })}
                              disabled={!newRow.courierName?.trim() || addMutation.isPending}
                              className="h-6 w-6 p-0"
                            >
                              <Check className="h-3 w-3 text-green-600" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => setIsAddingNew(false)} 
                              className="h-6 w-6 p-0"
                            >
                              <X className="h-3 w-3 text-red-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                    
                    {/* 기존 택배사 목록 */}
                    {courierList.map((c, index) => {
                      return (
                        <tr 
                          key={c.id} 
                          className="border-t hover:bg-muted/30"
                        >
                          <td className="p-1.5 text-center">
                            <div className="flex flex-col items-center gap-0">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={(e) => { e.stopPropagation(); moveItem(index, 'up'); }}
                                disabled={index === 0}
                                className="h-4 w-4 p-0"
                              >
                                <ChevronUp className="h-3 w-3" />
                              </Button>
                              <span className="text-muted-foreground text-[10px]">{index + 1}</span>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={(e) => { e.stopPropagation(); moveItem(index, 'down'); }}
                                disabled={index === courierList.length - 1}
                                className="h-4 w-4 p-0"
                              >
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                          <td className="p-1.5 font-medium">{c.courierName}</td>
                          <td className="p-1.5">{renderCell(c, 'basePricePerBox', 'select', '', 'w-full')}</td>
                          <td className="p-1.5">{renderCell(c, 'etcPricePerBox', 'select', '', 'w-full')}</td>
                          <td className="p-1.5">{renderCell(c, 'minTotal', 'select', '', 'w-full')}</td>
                          <td className="p-1.5">{renderCell(c, 'commissionRate', 'select', '', 'w-full')}</td>
                          <td className="p-1.5">{renderCell(c, 'urgentCommissionRate', 'select', '', 'w-full')}</td>
                          <td className="p-1.5">{renderCell(c, 'urgentSurchargeRate', 'select', '', 'w-full')}</td>
                          <td className="p-1.5 text-center">{renderCell(c, 'isActive', 'switch')}</td>
                          <td className="p-1.5">
                            <div className="flex gap-1 justify-center">
                              <Button 
                                size="sm" 
                                variant={editingRows[c.id] ? "default" : "outline"}
                                onClick={() => saveEdit(c.id)} 
                                disabled={!editingRows[c.id] || updateMutation.isPending}
                                className="h-6 px-2 text-xs"
                              >
                                저장
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (confirm(`"${c.courierName}" 삭제?`)) {
                                    deleteMutation.mutate(c.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    
                    {courierList.length === 0 && !isAddingNew && (
                      <tr>
                        <td colSpan={10} className="text-center py-6 text-muted-foreground">
                          등록된 택배사가 없습니다. "추가" 버튼을 클릭하세요.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : activeCategory === 'other' ? (
        /* 기타택배 - 착지당/박스당 단가 설정 */
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">기타택배 가격 설정</CardTitle>
            <CardDescription className="text-xs">
              착지당, 박스당 단가 설정 (값 변경 후 저장)
            </CardDescription>
          </CardHeader>
          <CardContent className="py-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="text-sm font-medium">착지단가 (원)</label>
                  <Input
                    type="number"
                    value={otherSettings.destinationPrice}
                    onChange={(e) => setOtherSettings({ ...otherSettings, destinationPrice: e.target.value })}
                    placeholder="예: 1800"
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">착지 기준 단가</p>
                </div>
                <div>
                  <label className="text-sm font-medium">박스단가 (원)</label>
                  <Input
                    type="number"
                    value={otherSettings.boxPrice}
                    onChange={(e) => setOtherSettings({ ...otherSettings, boxPrice: e.target.value })}
                    placeholder="예: 1500"
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">박스당 단가</p>
                </div>
                <div>
                  <label className="text-sm font-medium">일최저운임 (원)</label>
                  <Input
                    type="number"
                    value={otherSettings.minDailyFee}
                    onChange={(e) => setOtherSettings({ ...otherSettings, minDailyFee: e.target.value })}
                    placeholder="예: 50000"
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">하루 최저 운임</p>
                </div>
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <Button onClick={saveOtherSettings} disabled={saveSystemSettingMutation.isPending}>
                <Check className="h-4 w-4 mr-2" />
                {saveSystemSettingMutation.isPending ? '저장중...' : '저장'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* 냉탑전용 - 단일 가격 설정 카드 */
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">냉탑전용 가격 설정</CardTitle>
            <CardDescription className="text-xs">
              냉탑 차량 전용 가격 설정 (값 변경 후 저장)
            </CardDescription>
          </CardHeader>
          <CardContent className="py-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="max-w-md">
                <label className="text-sm font-medium">일최저단가 (원)</label>
                <Input
                  type="number"
                  value={coldSettings.minDailyFee}
                  onChange={(e) => setColdSettings({ ...coldSettings, minDailyFee: e.target.value })}
                  placeholder="예: 100000"
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">하루 최저 운임</p>
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <Button onClick={saveColdSettings} disabled={saveSystemSettingMutation.isPending}>
                <Check className="h-4 w-4 mr-2" />
                {saveSystemSettingMutation.isPending ? '저장중...' : '저장'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
        </>
      )}

      {/* 계약금/취소규정 섹션 */}
      {mainTab === 'deposit' && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">계약금 및 취소 규정 설정</CardTitle>
            <CardDescription className="text-xs">
              계약금 비율을 설정합니다. 변경 시 계약서와 결제 화면에 자동 반영됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="py-2 space-y-6">
            {/* 계약금 비율 */}
            <div>
              <label className="text-sm font-medium">계약금 비율 (%)</label>
              <Input
                type="number"
                value={depositSettings.depositRate}
                onChange={(e) => setDepositSettings({ ...depositSettings, depositRate: e.target.value })}
                placeholder="예: 10"
                className="mt-2 max-w-xs"
                min={0}
                max={100}
              />
              <p className="text-xs text-muted-foreground mt-1">오더 등록 시 예상 운임 대비 계약금 비율 (예: 10 → 예상 운임의 10%)</p>
            </div>

            {/* 취소 규정 안내 */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-4">취소 시 환불 규정 (매칭 기준)</h3>
              <div className="bg-muted/50 rounded p-4 text-sm space-y-3">
                <div className="flex items-start gap-3">
                  <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap">매칭 전</span>
                  <div>
                    <p className="font-medium">계약금 100% 환불</p>
                    <p className="text-muted-foreground text-xs">운송인(헬퍼) 배정 전 취소 시 전액 환불</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap">매칭 후</span>
                  <div>
                    <p className="font-medium">계약금 0% 환불 (환불 불가)</p>
                    <p className="text-muted-foreground text-xs">운송인 연락처 전달 후 취소 시 환불 불가 (개인 간 거래 특성)</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">* 취소 규정은 개인 간 거래 기준으로 고정되어 있으며, 계약서에 자동 반영됩니다.</p>
            </div>

            {/* 정산 규정 안내 */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-4">잔여금 정산 규정</h3>
              <div className="bg-blue-50 rounded p-4 text-sm space-y-2">
                <p>• 수량은 <strong>평균 예상치</strong>로 등록, 확정 수량 아님</p>
                <p>• 최종 운임은 헬퍼 <strong>마감 자료</strong>(실제 배송 수량) 기준 확정</p>
                <p>• 잔여금 = 최종 운임 - 계약금</p>
                <p>• 잔여금 청구일로부터 <strong>7일 이내</strong> 지급 의무</p>
                <p>• 미지급 시: 연 12% 지연이자 → 14일 후 서비스 제한 → 30일 후 법적 조치</p>
              </div>
            </div>

            {/* 계약서 반영 미리보기 */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-2">계약서 반영 미리보기</h3>
              <div className="bg-muted/50 rounded p-4 text-sm space-y-1">
                <p>• 계약금: 예상 운임의 <strong>{depositSettings.depositRate}%</strong></p>
                <p>• 매칭 전 취소: 계약금 <strong>100%</strong> 환불</p>
                <p>• 매칭 후(연락처 전달 후) 취소: 계약금 <strong>환불 불가</strong></p>
                <p>• 잔여금: 마감 자료 기준 확정 후 7일 내 지급</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={saveDepositSettings} disabled={saveSystemSettingMutation.isPending}>
                <Check className="h-4 w-4 mr-2" />
                {saveSystemSettingMutation.isPending ? '저장중...' : '저장'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
