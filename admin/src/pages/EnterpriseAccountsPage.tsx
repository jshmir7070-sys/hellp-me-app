import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';

interface EnterpriseAccount {
  id: number;
  name: string;
  businessNumber: string;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  commissionRate?: number | null;
  representativeName?: string | null;
  businessType?: string | null;
  businessItem?: string | null;
  address?: string | null;
  faxNumber?: string | null;
  taxEmail?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
  memo?: string | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  settlementModel?: string | null;
  taxType?: string | null;
  isActive?: boolean;
  createdAt?: string;
}

const RATE_OPTIONS = Array.from({ length: 21 }, (_, i) => i); // 0~20

const defaultForm = {
  name: '',
  businessNumber: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  commissionRate: 10,
  representativeName: '',
  businessType: '',
  businessItem: '',
  address: '',
  faxNumber: '',
  taxEmail: '',
  bankName: '',
  accountNumber: '',
  accountHolder: '',
  memo: '',
  contractStartDate: '',
  contractEndDate: '',
  settlementModel: 'per_order',
  taxType: 'exclusive',
};

export default function EnterpriseAccountsPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<EnterpriseAccount | null>(null);
  const [form, setForm] = useState({ ...defaultForm });

  const { data: accounts = [], isLoading } = useQuery<EnterpriseAccount[]>({
    queryKey: ['enterprise-accounts'],
    queryFn: async () => {
      const res = await adminFetch('/api/admin/enterprise-accounts', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await adminFetch('/api/admin/enterprise-accounts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || '등록 실패');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enterprise-accounts'] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: '협력업체가 등록되었습니다.' });
    },
    onError: (err: any) => {
      toast({ title: '등록 실패', description: err.message, variant: 'error' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof form> }) => {
      const res = await adminFetch(`/api/admin/enterprise-accounts/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || '수정 실패');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enterprise-accounts'] });
      setIsDialogOpen(false);
      setEditingAccount(null);
      resetForm();
      toast({ title: '협력업체 정보가 수정되었습니다.' });
    },
    onError: (err: any) => {
      toast({ title: '수정 실패', description: err.message, variant: 'error' });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await adminFetch(`/api/admin/enterprise-accounts/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('삭제 실패');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enterprise-accounts'] });
      toast({ title: '협력업체가 비활성화되었습니다.' });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await adminFetch(`/api/admin/enterprise-accounts/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) throw new Error('활성화 실패');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enterprise-accounts'] });
      toast({ title: '협력업체가 다시 활성화되었습니다.' });
    },
  });

  const resetForm = () => {
    setForm({ ...defaultForm });
  };

  const openCreate = () => {
    setEditingAccount(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const openEdit = (account: EnterpriseAccount) => {
    setEditingAccount(account);
    setForm({
      name: account.name,
      businessNumber: account.businessNumber,
      contactName: account.contactName || '',
      contactPhone: account.contactPhone || '',
      contactEmail: account.contactEmail || '',
      commissionRate: account.commissionRate ?? 10,
      representativeName: account.representativeName || '',
      businessType: account.businessType || '',
      businessItem: account.businessItem || '',
      address: account.address || '',
      faxNumber: account.faxNumber || '',
      taxEmail: account.taxEmail || '',
      bankName: account.bankName || '',
      accountNumber: account.accountNumber || '',
      accountHolder: account.accountHolder || '',
      memo: account.memo || '',
      contractStartDate: account.contractStartDate || '',
      contractEndDate: account.contractEndDate || '',
      settlementModel: account.settlementModel || 'per_order',
      taxType: account.taxType || 'exclusive',
    });
    setIsDialogOpen(true);
  };

  const handleDeactivate = async (account: EnterpriseAccount) => {
    const ok = await confirm({
      title: '협력업체 비활성화',
      description: `"${account.name}"을(를) 비활성화하시겠습니까?\n비활성화된 업체는 오더 등록 시 검색되지 않습니다.`,
    });
    if (ok) deactivateMutation.mutate(account.id);
  };

  const handleSubmit = () => {
    if (!form.name.trim() || !form.businessNumber.trim()) {
      toast({ title: '업체명과 사업자등록번호를 입력해주세요.', variant: 'error' });
      return;
    }
    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const updateField = (field: string, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const activeAccounts = accounts.filter(a => a.isActive !== false);
  const inactiveAccounts = accounts.filter(a => a.isActive === false);

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
          <h1 className="text-3xl font-bold">협력업체 등록</h1>
          <p className="text-muted-foreground">본사와 직계약된 업체를 등록하고 수수료율을 관리합니다</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          업체 추가
        </Button>
      </div>

      {/* 활성 업체 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            활성 협력업체 ({activeAccounts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeAccounts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              등록된 협력업체가 없습니다. "업체 추가" 버튼을 눌러 등록해주세요.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium">업체명</th>
                    <th className="px-4 py-3 text-left font-medium">사업자번호</th>
                    <th className="px-4 py-3 text-left font-medium">대표자</th>
                    <th className="px-4 py-3 text-left font-medium">담당자</th>
                    <th className="px-4 py-3 text-left font-medium">연락처</th>
                    <th className="px-4 py-3 text-center font-medium">수수료율</th>
                    <th className="px-4 py-3 text-center font-medium">상태</th>
                    <th className="px-4 py-3 text-right font-medium">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAccounts.map((account) => (
                    <tr key={account.id} className="border-b hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium">{account.name}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">{account.businessNumber}</td>
                      <td className="px-4 py-3">{account.representativeName || '-'}</td>
                      <td className="px-4 py-3">{account.contactName || '-'}</td>
                      <td className="px-4 py-3">
                        <div>{account.contactPhone || '-'}</div>
                        {account.contactEmail && (
                          <div className="text-xs text-muted-foreground">{account.contactEmail}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className="font-bold">
                          {account.commissionRate ?? 10}%
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className="bg-green-100 text-green-700">활성</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(account)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeactivate(account)} className="text-red-500 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 비활성 업체 */}
      {inactiveAccounts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-muted-foreground">
              비활성 업체 ({inactiveAccounts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium">업체명</th>
                    <th className="px-4 py-3 text-left font-medium">사업자번호</th>
                    <th className="px-4 py-3 text-center font-medium">수수료율</th>
                    <th className="px-4 py-3 text-center font-medium">상태</th>
                    <th className="px-4 py-3 text-right font-medium">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {inactiveAccounts.map((account) => (
                    <tr key={account.id} className="border-b hover:bg-gray-50/50 opacity-60">
                      <td className="px-4 py-3">{account.name}</td>
                      <td className="px-4 py-3 font-mono">{account.businessNumber}</td>
                      <td className="px-4 py-3 text-center">{account.commissionRate ?? 10}%</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className="text-red-500">비활성</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => reactivateMutation.mutate(account.id)}
                        >
                          다시 활성화
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 등록/수정 Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAccount ? '협력업체 수정' : '협력업체 등록'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* 기본 정보 */}
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-3 border-b pb-2">기본 정보</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>업체명 *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="예: CJ대한통운"
                  />
                </div>
                <div className="space-y-2">
                  <Label>사업자등록번호 *</Label>
                  <Input
                    value={form.businessNumber}
                    onChange={(e) => updateField('businessNumber', e.target.value)}
                    placeholder="000-00-00000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>대표자명</Label>
                  <Input
                    value={form.representativeName}
                    onChange={(e) => updateField('representativeName', e.target.value)}
                    placeholder="대표자명"
                  />
                </div>
                <div className="space-y-2">
                  <Label>수수료율 (%)</Label>
                  <Select
                    value={String(form.commissionRate)}
                    onValueChange={(v) => updateField('commissionRate', parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RATE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 계약 정보 */}
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-3 border-b pb-2">계약 정보</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>계약 시작일</Label>
                  <Input
                    type="date"
                    value={form.contractStartDate}
                    onChange={(e) => updateField('contractStartDate', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>계약 종료일</Label>
                  <Input
                    type="date"
                    value={form.contractEndDate}
                    onChange={(e) => updateField('contractEndDate', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>정산 모델</Label>
                  <Select
                    value={form.settlementModel}
                    onValueChange={(v) => updateField('settlementModel', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_order">건별</SelectItem>
                      <SelectItem value="monthly">월별</SelectItem>
                      <SelectItem value="weekly">주별</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>세금 유형</Label>
                  <Select
                    value={form.taxType}
                    onValueChange={(v) => updateField('taxType', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exclusive">별도</SelectItem>
                      <SelectItem value="inclusive">포함</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 사업자 상세 */}
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-3 border-b pb-2">사업자 상세</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>업태</Label>
                  <Input
                    value={form.businessType}
                    onChange={(e) => updateField('businessType', e.target.value)}
                    placeholder="예: 운수업"
                  />
                </div>
                <div className="space-y-2">
                  <Label>종목</Label>
                  <Input
                    value={form.businessItem}
                    onChange={(e) => updateField('businessItem', e.target.value)}
                    placeholder="예: 화물운송"
                  />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Label>사업장 주소</Label>
                <Input
                  value={form.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="사업장 주소 전체 입력"
                />
              </div>
            </div>

            {/* 담당자 정보 */}
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-3 border-b pb-2">담당자 정보</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>담당자명</Label>
                  <Input
                    value={form.contactName}
                    onChange={(e) => updateField('contactName', e.target.value)}
                    placeholder="홍길동"
                  />
                </div>
                <div className="space-y-2">
                  <Label>연락처</Label>
                  <Input
                    value={form.contactPhone}
                    onChange={(e) => updateField('contactPhone', e.target.value)}
                    placeholder="010-0000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>이메일</Label>
                  <Input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => updateField('contactEmail', e.target.value)}
                    placeholder="contact@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>팩스번호</Label>
                  <Input
                    value={form.faxNumber}
                    onChange={(e) => updateField('faxNumber', e.target.value)}
                    placeholder="02-0000-0000"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>세금계산서 이메일</Label>
                  <Input
                    type="email"
                    value={form.taxEmail}
                    onChange={(e) => updateField('taxEmail', e.target.value)}
                    placeholder="tax@company.com"
                  />
                </div>
              </div>
            </div>

            {/* 정산 계좌 */}
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-3 border-b pb-2">정산 계좌</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>은행명</Label>
                  <Input
                    value={form.bankName}
                    onChange={(e) => updateField('bankName', e.target.value)}
                    placeholder="예: 국민은행"
                  />
                </div>
                <div className="space-y-2">
                  <Label>계좌번호</Label>
                  <Input
                    value={form.accountNumber}
                    onChange={(e) => updateField('accountNumber', e.target.value)}
                    placeholder="000-000-000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>예금주</Label>
                  <Input
                    value={form.accountHolder}
                    onChange={(e) => updateField('accountHolder', e.target.value)}
                    placeholder="예금주명"
                  />
                </div>
              </div>
            </div>

            {/* 메모 */}
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-3 border-b pb-2">메모</h4>
              <textarea
                className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                value={form.memo}
                onChange={(e) => updateField('memo', e.target.value)}
                placeholder="특이사항이나 메모를 입력하세요"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>취소</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) ? '저장 중...' : editingAccount ? '수정' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
