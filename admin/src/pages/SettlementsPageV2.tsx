import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useConfirm } from '@/components/common/ConfirmDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';
import {
  Wallet,
  RefreshCw,
  Download,
  Search,
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  CalendarDays,
  Check,
  AlertCircle,
  CreditCard,
  Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateRangePicker, getDefaultDateRange, Pagination } from '@/components/common';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

// ============ 인터페이스 정의 ============

interface ExtraItem {
  name: string;
  unitPrice: number;
  quantity: number;
}

interface DailySettlement {
  id: number;
  orderId: number;
  helperId: number;
  helperName?: string;
  helperPhone?: string;
  requesterName?: string;
  category?: string;
  courierCompany?: string;
  deliveredCount: number;
  returnedCount: number;
  etcCount: number;
  extraCostsJson: ExtraItem[] | null;
  closingMemo: string;
  createdAt: string;
  pricePerBox: number;
  driverPayout: number;
  platformFee: number;
  finalTotal: number;
}

interface HelperSettlement {
  helperId: number;
  helperName: string;
  helperPhone: string;
  orderCount: number;
  supplyPrice: number;
  vat: number;
  totalAmount: number;
  platformFee: number;
  deductedAmount: number;
  deductions: number;
  cargoIncident: number;
  driverPayout: number;
}

interface RequesterSettlement {
  requesterId: string;
  requesterName: string;
  requesterPhone: string;
  businessName: string;
  orderCount: number;
  billedAmount: number;
  unpaidAmount: number;
  paymentDate: string | null;
}

interface TaxInvoice {
  id: number;
  targetType: 'helper' | 'requester';
  targetId: string;
  targetName: string;
  businessName?: string;
  businessNumber?: string;
  supplyAmount: number;
  vatAmount: number;
  totalAmount: number;
  issueDate: string | null;
  status: 'draft' | 'issued' | 'sent' | 'failed' | 'cancelled';
  popbillNtsConfirmNum?: string;
  year: number;
  month: number;
  createdAt: string;
  updatedAt: string;
}

// ============ 공통 설정 ============

const CATEGORY_LABELS: Record<string, string> = {
  parcel: '택배사',
  other: '기타택배',
  cold: '냉탑전용',
};

const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function formatAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '-';
  return amount.toLocaleString('ko-KR') + '원';
}

function getMonthRange(year: number, month: number) {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

// ============ 메인 컴포넌트 ============

export default function SettlementsPageV2() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const confirm = useConfirm();
  
  const [activeTab, setActiveTab] = useState<'daily' | 'helper' | 'requester' | 'tax-invoices'>('daily');
  const [searchTerm, setSearchTerm] = useState('');
  
  // 일정산용 날짜 범위
  const [dailyDateRange, setDailyDateRange] = useState(() => getDefaultDateRange(30));
  
  // 헬퍼/요청자 정산용 월별 선택
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const monthRange = getMonthRange(selectedYear, selectedMonth);
  
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [selectedDailySettlement, setSelectedDailySettlement] = useState<DailySettlement | null>(null);
  const [selectedHelper, setSelectedHelper] = useState<HelperSettlement | null>(null);
  const [selectedRequester, setSelectedRequester] = useState<RequesterSettlement | null>(null);

  // 페이지네이션 상태
  const [dailyPage, setDailyPage] = useState(1);
  const [helperPage, setHelperPage] = useState(1);
  const [requesterPage, setRequesterPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // 입금 확인 모달 상태
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    paymentMethod: 'bank_transfer' as string,
    transactionId: '',
    paidAmount: '',
    notes: '',
  });

  // ============ 데이터 조회 ============

  // 일정산
  const { data: dailySettlements = [], isLoading: loadingDaily } = useQuery({
    queryKey: ['/api/admin/settlements/daily', dailyDateRange.from, dailyDateRange.to],
    queryFn: async () => {
      const res = await adminFetch(`/api/admin/settlements/daily?startDate=${dailyDateRange.from}&endDate=${dailyDateRange.to}&limit=9999`);
      if (!res.ok) return [];
      const json = await res.json();
      // API가 { data: [...], pagination: {...} } 형식으로 반환
      return Array.isArray(json) ? json : (json.data || []);
    },
  });

  // 헬퍼 정산
  const { data: helperSettlements = [], isLoading: loadingHelper } = useQuery({
    queryKey: ['/api/admin/settlements/helper', monthRange.from, monthRange.to],
    queryFn: async () => {
      const res = await adminFetch(`/api/admin/settlements/helper?startDate=${monthRange.from}&endDate=${monthRange.to}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // 요청자 정산
  const { data: requesterSettlements = [], isLoading: loadingRequester } = useQuery<RequesterSettlement[]>({
    queryKey: ["/api/admin/settlements/requester", monthRange.from, monthRange.to],
    queryFn: async () => {
      const res = await adminFetch(`/api/admin/settlements/requester?startDate=${monthRange.from}&endDate=${monthRange.to}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // 세금계산서
  const [taxInvoicePage, setTaxInvoicePage] = useState(1);
  const [taxInvoiceFilter, setTaxInvoiceFilter] = useState<'all' | 'helper' | 'requester'>('all');
  const [selectedTaxInvoice, setSelectedTaxInvoice] = useState<TaxInvoice | null>(null);

  const { data: taxInvoices = [], isLoading: loadingTaxInvoices } = useQuery<TaxInvoice[]>({
    queryKey: ['/api/admin/tax-invoices', selectedYear, selectedMonth, taxInvoiceFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: String(selectedYear),
        month: String(selectedMonth + 1),
      });
      if (taxInvoiceFilter !== 'all') {
        params.set('targetType', taxInvoiceFilter);
      }
      const res = await adminFetch(`/api/admin/tax-invoices?${params.toString()}`);
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : (json.data || json.taxInvoices || []);
    },
    enabled: activeTab === 'tax-invoices',
  });

  const isLoading = loadingDaily || loadingHelper || loadingRequester || loadingTaxInvoices;

  // ============ 필터링 ============

  const filteredDailySettlements = dailySettlements.filter((s: DailySettlement) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      s.orderId.toString().includes(search) ||
      s.helperName?.toLowerCase().includes(search) ||
      s.requesterName?.toLowerCase().includes(search) ||
      s.courierCompany?.toLowerCase().includes(search)
    );
  });

  const filteredHelperSettlements = helperSettlements.filter((h: HelperSettlement) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      h.helperName.toLowerCase().includes(search) ||
      h.helperPhone.includes(search) ||
      h.helperId.toString().includes(search)
    );
  });

  const filteredRequesterSettlements = requesterSettlements.filter((r: RequesterSettlement) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      r.requesterName.toLowerCase().includes(search) ||
      r.requesterPhone.includes(search) ||
      r.businessName.toLowerCase().includes(search) ||
      r.requesterId.toString().includes(search)
    );
  });

  // ============ 통계 계산 ============

  const dailyStats = {
    count: filteredDailySettlements.length,
    totalDriverPayout: filteredDailySettlements.reduce((sum: number, s: DailySettlement) => sum + (s.driverPayout || 0), 0),
    totalPlatformFee: filteredDailySettlements.reduce((sum: number, s: DailySettlement) => sum + (s.platformFee || 0), 0),
    totalFinal: filteredDailySettlements.reduce((sum: number, s: DailySettlement) => sum + (s.finalTotal || 0), 0),
  };

  const helperStats = {
    count: filteredHelperSettlements.length,
    totalOrders: filteredHelperSettlements.reduce((sum: number, h: HelperSettlement) => sum + (h.orderCount || 0), 0),
    totalDriverPayout: filteredHelperSettlements.reduce((sum: number, h: HelperSettlement) => sum + (h.driverPayout || 0), 0),
    totalPlatformFee: filteredHelperSettlements.reduce((sum: number, h: HelperSettlement) => sum + (h.platformFee || 0), 0),
  };

  const requesterStats = {
    count: filteredRequesterSettlements.length,
    totalOrders: filteredRequesterSettlements.reduce((sum: number, r: RequesterSettlement) => sum + (r.orderCount || 0), 0),
    totalBilled: filteredRequesterSettlements.reduce((sum: number, r: RequesterSettlement) => sum + (r.billedAmount || 0), 0),
    totalUnpaid: filteredRequesterSettlements.reduce((sum: number, r: RequesterSettlement) => sum + (r.unpaidAmount || 0), 0),
  };

  const filteredTaxInvoices = taxInvoices.filter((inv: TaxInvoice) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      inv.targetName?.toLowerCase().includes(search) ||
      inv.businessName?.toLowerCase().includes(search) ||
      inv.businessNumber?.includes(search) ||
      inv.popbillNtsConfirmNum?.includes(search) ||
      inv.targetId?.toString().includes(search)
    );
  });

  const taxInvoiceStats = {
    count: filteredTaxInvoices.length,
    totalSupply: filteredTaxInvoices.reduce((sum: number, inv: TaxInvoice) => sum + (inv.supplyAmount || 0), 0),
    totalVat: filteredTaxInvoices.reduce((sum: number, inv: TaxInvoice) => sum + (inv.vatAmount || 0), 0),
    totalAmount: filteredTaxInvoices.reduce((sum: number, inv: TaxInvoice) => sum + (inv.totalAmount || 0), 0),
    issuedCount: filteredTaxInvoices.filter((inv: TaxInvoice) => inv.status === 'issued' || inv.status === 'sent').length,
    draftCount: filteredTaxInvoices.filter((inv: TaxInvoice) => inv.status === 'draft').length,
  };

  // ============ 액션 핸들러 ============

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/settlements/daily'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/settlements/helper'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/settlements/requester'] });
    toast({ title: '데이터를 새로고침했습니다.', variant: 'success' });
  };

  const handleDownloadExcel = () => {
    let data: any[] = [];
    let filename = '';

    if (activeTab === 'daily') {
      data = filteredDailySettlements.map((item: DailySettlement) => ({
        '오더번호': item.orderId,
        '요청자': item.requesterName || '',
        '헬퍼': item.helperName || '',
        '헬퍼연락처': item.helperPhone || '',
        '카테고리': CATEGORY_LABELS[item.category || ''] || item.category || '',
        '운송사': item.courierCompany || '',
        '배송수량': item.deliveredCount || 0,
        '반품수량': item.returnedCount || 0,
        '기타수량': item.etcCount || 0,
        '박스단가': item.pricePerBox || 0,
        '최종금액': item.finalTotal || 0,
        '플랫폼수수료': item.platformFee || 0,
        '헬퍼지급액': item.driverPayout || 0,
        '마감일시': item.createdAt ? new Date(item.createdAt).toLocaleDateString('ko-KR') : '',
      }));
      filename = `일정산_${new Date().toISOString().slice(0, 10)}.csv`;
    } else if (activeTab === 'helper') {
      data = filteredHelperSettlements.map((item: HelperSettlement) => ({
        '헬퍼ID': item.helperId,
        '헬퍼명': item.helperName,
        '연락처': item.helperPhone,
        '오더수': item.orderCount,
        '공급가': item.supplyPrice,
        '부가세': item.vat,
        '총액': item.totalAmount,
        '플랫폼수수료': item.platformFee,
        '차감액': item.deductedAmount,
        '지급액': item.driverPayout,
      }));
      filename = `헬퍼정산_${selectedYear}년${selectedMonth + 1}월.csv`;
    } else {
      data = filteredRequesterSettlements.map((item: RequesterSettlement) => ({
        '요청자ID': item.requesterId,
        '요청자명': item.requesterName,
        '사업자명': item.businessName,
        '연락처': item.requesterPhone,
        '오더수': item.orderCount,
        '청구금액': item.billedAmount,
        '미수금액': item.unpaidAmount,
        '입금일': item.paymentDate || '',
      }));
      filename = `요청자정산_${selectedYear}년${selectedMonth + 1}월.csv`;
    }

    if (data.length === 0) {
      toast({ title: '다운로드할 데이터가 없습니다.', variant: 'warning' });
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map((row: Record<string, unknown>) => headers.map(h => row[h]).join(','))
    ].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Excel 다운로드 완료', variant: 'success' });
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedYear(selectedYear - 1);
      setSelectedMonth(11);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedYear(selectedYear + 1);
      setSelectedMonth(0);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // ============ 정산 기능 Mutations ============

  // 1. 거래명세서 다운로드 (헬퍼 주문 상세 → CSV)
  const handleDownloadStatement = async (helper: HelperSettlement) => {
    try {
      const res = await adminFetch(
        `/api/admin/settlements/helper/${helper.helperId}/orders?startDate=${monthRange.from}&endDate=${monthRange.to}`
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || '거래명세서 조회 실패');
      }
      const data = await res.json();
      const orders = data.orders || [];

      if (orders.length === 0) {
        toast({ title: '해당 기간 거래 내역이 없습니다.', variant: 'warning' });
        return;
      }

      // CSV 생성
      const csvRows = orders.map((o: any, i: number) => ({
        '순번': i + 1,
        '오더번호': o.orderId || '',
        '작업일': o.createdAt ? new Date(o.createdAt).toLocaleDateString('ko-KR') : '',
        '요청자': o.requesterName || '',
        '카테고리': CATEGORY_LABELS[o.category || ''] || o.category || '',
        '운송사': o.courierCompany || '',
        '배송수량': o.deliveredCount || 0,
        '반품수량': o.returnedCount || 0,
        '박스단가': o.pricePerBox || 0,
        '공급가': o.supplyAmount || 0,
        '부가세': o.vatAmount || 0,
        '차감액': o.deduction || 0,
        '지급액': o.payout || 0,
      }));

      const headers = Object.keys(csvRows[0]);
      const csvContent = [
        `거래명세서 - ${helper.helperName} (${selectedYear}년 ${selectedMonth + 1}월)`,
        '',
        headers.join(','),
        ...csvRows.map((row: Record<string, unknown>) => headers.map(h => row[h]).join(',')),
        '',
        `합계,,,,,,,,${data.summary?.totalSupply || 0},${data.summary?.totalVat || 0},${data.summary?.totalDeduction || 0},${data.summary?.totalPayout || 0}`,
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `거래명세서_${helper.helperName}_${selectedYear}년${selectedMonth + 1}월.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast({ title: '거래명세서 다운로드 완료', variant: 'success' });
    } catch (err: any) {
      toast({ title: err.message || '거래명세서 다운로드 실패', variant: 'error' });
    }
  };

  // 2. 정산 확정 (헬퍼 정산의 일정산 건들을 confirm)
  const confirmSettlementMutation = useMutation({
    mutationFn: async (helperId: number) => {
      // 헬퍼의 해당 월 일정산 건들을 가져와서 각각 confirm 처리
      const relevantDaily = dailySettlements.filter(
        (d: DailySettlement) => d.helperId === helperId
      );
      if (relevantDaily.length === 0) {
        throw new Error('확정할 정산 건이 없습니다.');
      }
      const results = await Promise.allSettled(
        relevantDaily.map((d: DailySettlement) =>
          adminFetch(`/api/admin/settlements/${d.id}/confirm`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
          })
        )
      );
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0 && failed.length === results.length) {
        throw new Error('정산 확정에 실패했습니다. 이미 확정된 건이거나 권한이 없습니다.');
      }
      return { total: results.length, success: results.length - failed.length, failed: failed.length };
    },
    onSuccess: (result) => {
      toast({
        title: '정산 확정 완료',
        description: `총 ${result.total}건 중 ${result.success}건 확정 완료${result.failed > 0 ? ` (${result.failed}건 실패/이미처리됨)` : ''}`,
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settlements/daily'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settlements/helper'] });
    },
    onError: (err: any) => {
      toast({ title: err.message || '정산 확정 실패', variant: 'error' });
    },
  });

  // 3. 세금계산서 발행 (요청자 정산 기반)
  const createTaxInvoiceMutation = useMutation({
    mutationFn: async (_requesterId: string) => {
      // 요청자의 해당 월 일정산 건들을 기반으로 세금계산서 생성
      const relevantDaily = dailySettlements.filter(
        (d: DailySettlement) => String(d.requesterName) === String(selectedRequester?.requesterName)
      );
      if (relevantDaily.length === 0) {
        throw new Error('세금계산서를 발행할 정산 건이 없습니다.');
      }
      // 첫 번째 건 기반으로 세금계산서 생성 (월 합산)
      const res = await adminFetch(`/api/admin/settlements/${relevantDaily[0].id}/create-tax-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueType: 'forward' }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || '세금계산서 생성 실패');
      }
      const data = await res.json();

      // 생성된 세금계산서를 바로 발행
      if (data.taxInvoice?.id) {
        const issueRes = await adminFetch(`/api/admin/tax-invoices/${data.taxInvoice.id}/issue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!issueRes.ok) {
          return { ...data, issued: false, message: '세금계산서가 생성되었으나 발행은 실패했습니다. 수동으로 발행해주세요.' };
        }
        return { ...data, issued: true };
      }
      return data;
    },
    onSuccess: (result) => {
      toast({
        title: result.issued ? '세금계산서 발행 완료' : '세금계산서 생성 완료',
        description: result.issued
          ? '세금계산서가 성공적으로 발행되었습니다.'
          : result.message || '세금계산서가 생성되었습니다.',
        variant: 'success',
      });
    },
    onError: (err: any) => {
      toast({ title: err.message || '세금계산서 발행 실패', variant: 'error' });
    },
  });

  // 4. 입금 확인 (요청자 미수금 처리)
  const markPaidMutation = useMutation({
    mutationFn: async ({ form }: { requesterId: string; form: typeof paymentForm }) => {
      // 요청자의 해당 월 일정산 건들 중 미지급 건을 mark-paid 처리
      const relevantDaily = dailySettlements.filter(
        (d: DailySettlement) => String(d.requesterName) === String(selectedRequester?.requesterName)
      );
      if (relevantDaily.length === 0) {
        throw new Error('입금 처리할 정산 건이 없습니다.');
      }
      const results = await Promise.allSettled(
        relevantDaily.map((d: DailySettlement) =>
          adminFetch(`/api/admin/settlements/${d.id}/mark-paid`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentMethod: form.paymentMethod,
              transactionId: form.transactionId || undefined,
              paidAmount: form.paidAmount ? Number(form.paidAmount) : undefined,
              notes: form.notes || undefined,
              confirmManualPayment: true,
            }),
          })
        )
      );
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0 && failed.length === results.length) {
        throw new Error('입금 처리에 실패했습니다.');
      }
      return { total: results.length, success: results.length - failed.length, failed: failed.length };
    },
    onSuccess: (result) => {
      toast({
        title: '입금 확인 완료',
        description: `총 ${result.total}건 중 ${result.success}건 처리 완료`,
        variant: 'success',
      });
      setShowPaymentConfirm(false);
      setPaymentForm({ paymentMethod: 'bank_transfer', transactionId: '', paidAmount: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settlements/requester'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/settlements/daily'] });
    },
    onError: (err: any) => {
      toast({ title: err.message || '입금 확인 실패', variant: 'error' });
    },
  });

  // 5. 세금계산서 발행 (단건)
  const issueTaxInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      const res = await adminFetch(`/api/admin/tax-invoices/${invoiceId}/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || '세금계산서 발행 실패');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '세금계산서가 발행되었습니다.', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tax-invoices'] });
    },
    onError: (err: any) => {
      toast({ title: err.message || '세금계산서 발행 실패', variant: 'error' });
    },
  });

  // 6. 세금계산서 PDF 다운로드
  const downloadTaxInvoicePdfMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      const res = await adminFetch(`/api/admin/tax-invoices/${invoiceId}/popbill-pdf`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'PDF 다운로드 실패');
      }
      const data = await res.json();
      if (data.pdfUrl) {
        window.open(data.pdfUrl, '_blank');
      } else {
        throw new Error('PDF URL을 받지 못했습니다.');
      }
      return data;
    },
    onSuccess: () => {
      toast({ title: 'PDF 다운로드 시작', variant: 'success' });
    },
    onError: (err: any) => {
      toast({ title: err.message || 'PDF 다운로드 실패', variant: 'error' });
    },
  });

  // 7. 월 일괄 세금계산서 생성
  const generateMonthlyTaxInvoicesMutation = useMutation({
    mutationFn: async () => {
      const res = await adminFetch(`/api/admin/tax-invoices/generate-monthly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: selectedYear, month: selectedMonth + 1 }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || '일괄 생성 실패');
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: '월 일괄 세금계산서 생성 완료',
        description: `${data.created || 0}건 생성, ${data.skipped || 0}건 스킵`,
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tax-invoices'] });
    },
    onError: (err: any) => {
      toast({ title: err.message || '일괄 생성 실패', variant: 'error' });
    },
  });

  // ============ 컬럼 정의 ============

  const dailyColumns: ColumnDef<DailySettlement>[] = [
    {
      key: 'orderId',
      header: '오더번호',
      width: 90,
      render: (value) => <span className="font-mono text-sm font-medium">#{value}</span>,
    },
    {
      key: 'requesterName',
      header: '요청자',
      width: 100,
      render: (value) => value || '-',
    },
    {
      key: 'helperName',
      header: '헬퍼',
      width: 120,
      render: (value, row) => (
        <div>
          <div className="font-medium">{value || '-'}</div>
          {row.helperPhone && (
            <div className="text-xs text-muted-foreground">{row.helperPhone}</div>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: '카테고리',
      width: 90,
      render: (value) => (
        <Badge variant="outline">
          {CATEGORY_LABELS[value || ''] || value || '-'}
        </Badge>
      ),
    },
    {
      key: 'courierCompany',
      header: '운송사',
      width: 120,
      render: (value) => value || '-',
    },
    {
      key: 'deliveredCount',
      header: '배송',
      width: 60,
      align: 'center',
      render: (value) => value || 0,
    },
    {
      key: 'returnedCount',
      header: '반품',
      width: 60,
      align: 'center',
      render: (value) => value || 0,
    },
    {
      key: 'finalTotal',
      header: '최종금액',
      width: 110,
      align: 'right',
      render: (value) => <span className="font-medium">{formatAmount(value)}</span>,
    },
    {
      key: 'platformFee',
      header: '수수료',
      width: 90,
      align: 'right',
      render: (value) => <span className="text-sm">{formatAmount(value)}</span>,
    },
    {
      key: 'driverPayout',
      header: '헬퍼지급액',
      width: 110,
      align: 'right',
      render: (value) => <span className="font-medium text-green-600">{formatAmount(value)}</span>,
    },
  ];

  const helperColumns: ColumnDef<HelperSettlement>[] = [
    {
      key: 'helperId',
      header: 'ID',
      width: 70,
      render: (value) => <span className="font-mono text-sm">#{value}</span>,
    },
    {
      key: 'helperName',
      header: '헬퍼명',
      width: 120,
      render: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-xs text-muted-foreground">{row.helperPhone}</div>
        </div>
      ),
    },
    {
      key: 'orderCount',
      header: '오더수',
      width: 70,
      align: 'center',
      render: (value) => <Badge variant="secondary">{value}건</Badge>,
    },
    {
      key: 'supplyPrice',
      header: '공급가',
      width: 110,
      align: 'right',
      render: (value) => <span className="text-sm">{formatAmount(value)}</span>,
    },
    {
      key: 'vat',
      header: '부가세',
      width: 90,
      align: 'right',
      render: (value) => <span className="text-sm">{formatAmount(value)}</span>,
    },
    {
      key: 'totalAmount',
      header: '총액',
      width: 110,
      align: 'right',
      render: (value) => <span className="font-medium">{formatAmount(value)}</span>,
    },
    {
      key: 'platformFee',
      header: '수수료',
      width: 100,
      align: 'right',
      render: (value) => <span className="text-sm text-red-600">-{formatAmount(value)}</span>,
    },
    {
      key: 'deductedAmount',
      header: '차감',
      width: 90,
      align: 'right',
      render: (value) => value > 0 ? (
        <span className="text-sm text-red-600">-{formatAmount(value)}</span>
      ) : (
        <span className="text-sm text-muted-foreground">-</span>
      ),
    },
    {
      key: 'driverPayout',
      header: '지급액',
      width: 120,
      align: 'right',
      render: (value) => <span className="font-bold text-green-600">{formatAmount(value)}</span>,
    },
  ];

  const requesterColumns: ColumnDef<RequesterSettlement>[] = [
    {
      key: 'requesterId',
      header: 'ID',
      width: 70,
      render: (value) => <span className="font-mono text-sm">#{value}</span>,
    },
    {
      key: 'requesterName',
      header: '요청자명',
      width: 120,
      render: (value, row) => (
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-xs text-muted-foreground">{row.businessName}</div>
        </div>
      ),
    },
    {
      key: 'requesterPhone',
      header: '연락처',
      width: 120,
      render: (value) => value || '-',
    },
    {
      key: 'orderCount',
      header: '오더수',
      width: 70,
      align: 'center',
      render: (value) => <Badge variant="secondary">{value}건</Badge>,
    },
    {
      key: 'billedAmount',
      header: '청구금액',
      width: 120,
      align: 'right',
      render: (value) => <span className="font-medium">{formatAmount(value)}</span>,
    },
    {
      key: 'unpaidAmount',
      header: '미수금액',
      width: 120,
      align: 'right',
      render: (value) => value > 0 ? (
        <span className="font-medium text-orange-600">{formatAmount(value)}</span>
      ) : (
        <span className="text-sm text-green-600">완납</span>
      ),
    },
    {
      key: 'paymentDate',
      header: '입금일',
      width: 100,
      render: (value) => value ? (
        <span className="text-sm">{new Date(value).toLocaleDateString('ko-KR')}</span>
      ) : (
        <span className="text-sm text-muted-foreground">-</span>
      ),
    },
  ];

  const TAX_INVOICE_STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    draft: { label: '작성중', variant: 'secondary' },
    issued: { label: '발행완료', variant: 'default' },
    sent: { label: '전송완료', variant: 'default' },
    failed: { label: '발행실패', variant: 'destructive' },
    cancelled: { label: '취소', variant: 'outline' },
  };

  const taxInvoiceColumns: ColumnDef<TaxInvoice>[] = [
    {
      key: 'id',
      header: 'ID',
      width: 60,
      render: (value) => <span className="font-mono text-sm">#{value}</span>,
    },
    {
      key: 'targetType',
      header: '구분',
      width: 80,
      render: (value) => (
        <Badge variant={value === 'helper' ? 'secondary' : 'outline'}>
          {value === 'helper' ? '헬퍼' : '요청자'}
        </Badge>
      ),
    },
    {
      key: 'targetName',
      header: '대상자',
      width: 130,
      render: (value, row) => (
        <div>
          <div className="font-medium">{value || '-'}</div>
          {row.businessName && (
            <div className="text-xs text-muted-foreground">{row.businessName}</div>
          )}
        </div>
      ),
    },
    {
      key: 'businessNumber',
      header: '사업자번호',
      width: 120,
      render: (value) => <span className="font-mono text-sm">{value || '-'}</span>,
    },
    {
      key: 'supplyAmount',
      header: '공급가액',
      width: 110,
      align: 'right',
      render: (value) => <span className="text-sm">{formatAmount(value)}</span>,
    },
    {
      key: 'vatAmount',
      header: '부가세',
      width: 90,
      align: 'right',
      render: (value) => <span className="text-sm">{formatAmount(value)}</span>,
    },
    {
      key: 'totalAmount',
      header: '합계',
      width: 110,
      align: 'right',
      render: (value) => <span className="font-medium">{formatAmount(value)}</span>,
    },
    {
      key: 'status',
      header: '상태',
      width: 90,
      render: (value) => {
        const info = TAX_INVOICE_STATUS_MAP[value] || { label: value, variant: 'outline' as const };
        return <Badge variant={info.variant}>{info.label}</Badge>;
      },
    },
    {
      key: 'issueDate',
      header: '발행일',
      width: 100,
      render: (value) => value ? (
        <span className="text-sm">{new Date(value).toLocaleDateString('ko-KR')}</span>
      ) : (
        <span className="text-sm text-muted-foreground">-</span>
      ),
    },
    {
      key: 'id' as any,
      header: '액션',
      width: 160,
      render: (_value, row) => (
        <div className="flex items-center gap-1">
          {(row.status === 'issued' || row.status === 'sent') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={(e) => { e.stopPropagation(); downloadTaxInvoicePdfMutation.mutate(row.id); }}
              disabled={downloadTaxInvoicePdfMutation.isPending}
            >
              <Download className="h-3 w-3 mr-1" />
              PDF
            </Button>
          )}
          {row.status === 'draft' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-blue-600"
              onClick={async (e) => {
                e.stopPropagation();
                if (await confirm({ title: '세금계산서 발행', description: '이 세금계산서를 발행하시겠습니까?' })) {
                  issueTaxInvoiceMutation.mutate(row.id);
                }
              }}
              disabled={issueTaxInvoiceMutation.isPending}
            >
              <FileText className="h-3 w-3 mr-1" />
              발행
            </Button>
          )}
        </div>
      ),
    },
  ];

  // ============ 렌더링 ============

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">💵 정산 관리</h1>
          <p className="text-muted-foreground">일정산, 헬퍼정산, 요청자정산, 세금계산서를 통합 관리합니다</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            새로고침
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
            <Download className="h-4 w-4 mr-2" />
            Excel
          </Button>
        </div>
      </div>

      {/* 통합 카드 */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <div className="flex items-center justify-between mb-4">
              <TabsList className="grid grid-cols-4 w-[600px]">
                <TabsTrigger value="daily">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  일정산
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                    {dailyStats.count}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="helper">
                  <Users className="h-4 w-4 mr-2" />
                  헬퍼정산
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                    {helperStats.count}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="requester">
                  <Wallet className="h-4 w-4 mr-2" />
                  요청자정산
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                    {requesterStats.count}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="tax-invoices">
                  <Receipt className="h-4 w-4 mr-2" />
                  세금계산서
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                    {taxInvoiceStats.count}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              {/* 검색 및 날짜 필터 */}
              <div className="flex items-center gap-2">
                {activeTab === 'daily' ? (
                  <DateRangePicker value={dailyDateRange} onChange={setDailyDateRange} />
                ) : (
                  <div className="flex items-center gap-2 border rounded-md px-3 py-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Button variant="ghost" size="sm" onClick={handlePrevMonth} className="h-6 w-6 p-0">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-[80px] text-center">
                      {selectedYear}년 {monthNames[selectedMonth]}
                    </span>
                    <Button variant="ghost" size="sm" onClick={handleNextMonth} className="h-6 w-6 p-0">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                
                <div className="relative w-80">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={
                      activeTab === 'daily' 
                        ? '오더번호, 헬퍼, 요청자 검색...'
                        : activeTab === 'helper'
                        ? '헬퍼명, 연락처 검색...'
                        : '요청자명, 사업자명 검색...'
                    }
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* 일정산 탭 */}
            <TabsContent value="daily" className="space-y-4">
              {/* 통계 */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 건수</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dailyStats.count}건</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 최종금액</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatAmount(dailyStats.totalFinal)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 수수료</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{formatAmount(dailyStats.totalPlatformFee)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 헬퍼지급액</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{formatAmount(dailyStats.totalDriverPayout)}</div>
                  </CardContent>
                </Card>
              </div>

              {/* 테이블 */}
              <ExcelTable
                columns={dailyColumns}
                data={filteredDailySettlements.slice((dailyPage - 1) * itemsPerPage, dailyPage * itemsPerPage)}
                onRowClick={(row) => setSelectedDailySettlement(row)}
                selectable={true}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                loading={loadingDaily}
              />
              <Pagination
                currentPage={dailyPage}
                totalPages={Math.ceil(filteredDailySettlements.length / itemsPerPage) || 1}
                totalItems={filteredDailySettlements.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setDailyPage}
                onItemsPerPageChange={(v) => { setItemsPerPage(v); setDailyPage(1); }}
              />
            </TabsContent>

            {/* 헬퍼정산 탭 */}
            <TabsContent value="helper" className="space-y-4">
              {/* 통계 */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">헬퍼 수</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{helperStats.count}명</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 오더</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{helperStats.totalOrders}건</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 수수료</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{formatAmount(helperStats.totalPlatformFee)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 지급액</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{formatAmount(helperStats.totalDriverPayout)}</div>
                  </CardContent>
                </Card>
              </div>

              {/* 테이블 */}
              <ExcelTable
                columns={helperColumns}
                data={filteredHelperSettlements.slice((helperPage - 1) * itemsPerPage, helperPage * itemsPerPage)}
                onRowClick={(row) => setSelectedHelper(row)}
                selectable={true}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                loading={loadingHelper}
              />
              <Pagination
                currentPage={helperPage}
                totalPages={Math.ceil(filteredHelperSettlements.length / itemsPerPage) || 1}
                totalItems={filteredHelperSettlements.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setHelperPage}
                onItemsPerPageChange={(v) => { setItemsPerPage(v); setHelperPage(1); }}
              />
            </TabsContent>

            {/* 요청자정산 탭 */}
            <TabsContent value="requester" className="space-y-4">
              {/* 통계 */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">요청자 수</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{requesterStats.count}명</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 오더</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{requesterStats.totalOrders}건</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 청구금액</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatAmount(requesterStats.totalBilled)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 미수금액</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">{formatAmount(requesterStats.totalUnpaid)}</div>
                  </CardContent>
                </Card>
              </div>

              {/* 테이블 */}
              <ExcelTable
                columns={requesterColumns}
                data={filteredRequesterSettlements.slice((requesterPage - 1) * itemsPerPage, requesterPage * itemsPerPage)}
                onRowClick={(row) => setSelectedRequester(row)}
                selectable={true}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                loading={loadingRequester}
              />
              <Pagination
                currentPage={requesterPage}
                totalPages={Math.ceil(filteredRequesterSettlements.length / itemsPerPage) || 1}
                totalItems={filteredRequesterSettlements.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setRequesterPage}
                onItemsPerPageChange={(v) => { setItemsPerPage(v); setRequesterPage(1); }}
              />
            </TabsContent>

            {/* 세금계산서 탭 */}
            <TabsContent value="tax-invoices" className="space-y-4">
              {/* 통계 */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 건수</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{taxInvoiceStats.count}건</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      발행 {taxInvoiceStats.issuedCount} / 미발행 {taxInvoiceStats.draftCount}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 공급가액</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatAmount(taxInvoiceStats.totalSupply)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 부가세</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{formatAmount(taxInvoiceStats.totalVat)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 합계금액</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{formatAmount(taxInvoiceStats.totalAmount)}</div>
                  </CardContent>
                </Card>
              </div>

              {/* 필터 & 액션 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Select value={taxInvoiceFilter} onValueChange={(v) => setTaxInvoiceFilter(v as any)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      <SelectItem value="helper">헬퍼</SelectItem>
                      <SelectItem value="requester">요청자</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (await confirm({ title: '세금계산서 일괄 생성', description: `${selectedYear}년 ${monthNames[selectedMonth]} 세금계산서를 일괄 생성하시겠습니까?` })) {
                      generateMonthlyTaxInvoicesMutation.mutate();
                    }
                  }}
                  disabled={generateMonthlyTaxInvoicesMutation.isPending}
                >
                  {generateMonthlyTaxInvoicesMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  월 일괄 생성
                </Button>
              </div>

              {/* 테이블 */}
              <ExcelTable
                columns={taxInvoiceColumns}
                data={filteredTaxInvoices.slice((taxInvoicePage - 1) * itemsPerPage, taxInvoicePage * itemsPerPage)}
                onRowClick={(row) => setSelectedTaxInvoice(row)}
                selectable={false}
                loading={loadingTaxInvoices}
              />
              <Pagination
                currentPage={taxInvoicePage}
                totalPages={Math.ceil(filteredTaxInvoices.length / itemsPerPage) || 1}
                totalItems={filteredTaxInvoices.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setTaxInvoicePage}
                onItemsPerPageChange={(v) => { setItemsPerPage(v); setTaxInvoicePage(1); }}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 세금계산서 상세 모달 */}
      <Dialog open={!!selectedTaxInvoice} onOpenChange={() => setSelectedTaxInvoice(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              세금계산서 상세 - #{selectedTaxInvoice?.id}
            </DialogTitle>
          </DialogHeader>
          {selectedTaxInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">구분</div>
                  <div className="font-medium">
                    {selectedTaxInvoice.targetType === 'helper' ? '헬퍼' : '요청자'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">대상자</div>
                  <div className="font-medium">{selectedTaxInvoice.targetName}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">사업자명</div>
                  <div className="font-medium">{selectedTaxInvoice.businessName || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">사업자번호</div>
                  <div className="font-mono text-sm">{selectedTaxInvoice.businessNumber || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">귀속년월</div>
                  <div className="font-medium">{selectedTaxInvoice.year}년 {selectedTaxInvoice.month}월</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">상태</div>
                  <Badge variant={TAX_INVOICE_STATUS_MAP[selectedTaxInvoice.status]?.variant || 'outline'}>
                    {TAX_INVOICE_STATUS_MAP[selectedTaxInvoice.status]?.label || selectedTaxInvoice.status}
                  </Badge>
                </div>
              </div>

              <div className="border rounded-lg divide-y">
                <div className="flex justify-between p-3">
                  <span className="text-muted-foreground">공급가액</span>
                  <span className="font-medium">{formatAmount(selectedTaxInvoice.supplyAmount)}</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="text-muted-foreground">부가세</span>
                  <span className="font-medium">{formatAmount(selectedTaxInvoice.vatAmount)}</span>
                </div>
                <div className="flex justify-between p-3 bg-blue-50">
                  <span className="font-semibold">합계금액</span>
                  <span className="font-bold text-blue-600">{formatAmount(selectedTaxInvoice.totalAmount)}</span>
                </div>
                {selectedTaxInvoice.issueDate && (
                  <div className="flex justify-between p-3">
                    <span className="text-muted-foreground">발행일</span>
                    <span className="font-medium">{new Date(selectedTaxInvoice.issueDate).toLocaleDateString('ko-KR')}</span>
                  </div>
                )}
                {selectedTaxInvoice.popbillNtsConfirmNum && (
                  <div className="flex justify-between p-3">
                    <span className="text-muted-foreground">국세청 승인번호</span>
                    <span className="font-mono text-sm">{selectedTaxInvoice.popbillNtsConfirmNum}</span>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelectedTaxInvoice(null)}>
                  닫기
                </Button>
                {(selectedTaxInvoice.status === 'issued' || selectedTaxInvoice.status === 'sent') && (
                  <Button
                    variant="outline"
                    onClick={() => downloadTaxInvoicePdfMutation.mutate(selectedTaxInvoice.id)}
                    disabled={downloadTaxInvoicePdfMutation.isPending}
                  >
                    {downloadTaxInvoicePdfMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    PDF 다운로드
                  </Button>
                )}
                {selectedTaxInvoice.status === 'draft' && (
                  <Button
                    onClick={async () => {
                      if (await confirm({ title: '세금계산서 발행', description: '이 세금계산서를 발행하시겠습니까?' })) {
                        issueTaxInvoiceMutation.mutate(selectedTaxInvoice.id);
                        setSelectedTaxInvoice(null);
                      }
                    }}
                    disabled={issueTaxInvoiceMutation.isPending}
                  >
                    {issueTaxInvoiceMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Receipt className="h-4 w-4 mr-2" />
                    )}
                    세금계산서 발행
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 헬퍼 정산 상세 모달 */}
      <Dialog open={!!selectedHelper} onOpenChange={() => setSelectedHelper(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              헬퍼 정산 상세 - {selectedHelper?.helperName} ({selectedYear}년 {monthNames[selectedMonth]})
            </DialogTitle>
          </DialogHeader>
          
          {selectedHelper && (
            <div className="space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">헬퍼명</div>
                  <div className="font-medium">{selectedHelper.helperName}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">연락처</div>
                  <div className="font-medium">{selectedHelper.helperPhone}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">헬퍼 ID</div>
                  <div className="font-mono text-sm">{selectedHelper.helperId}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">오더 수</div>
                  <div className="font-medium text-lg">{selectedHelper.orderCount}건</div>
                </div>
              </div>

              {/* 정산 상세 */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">정산 내역</h3>
                <div className="border rounded-lg divide-y">
                  <div className="flex justify-between p-3 hover:bg-muted/50">
                    <span className="text-muted-foreground">공급가액</span>
                    <span className="font-medium">{formatAmount(selectedHelper.supplyPrice)}</span>
                  </div>
                  <div className="flex justify-between p-3 hover:bg-muted/50">
                    <span className="text-muted-foreground">부가세 (10%)</span>
                    <span className="font-medium">{formatAmount(selectedHelper.vat)}</span>
                  </div>
                  <div className="flex justify-between p-3 hover:bg-muted/50 bg-blue-50">
                    <span className="font-semibold">총 거래액</span>
                    <span className="font-bold text-blue-600">{formatAmount(selectedHelper.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between p-3 hover:bg-muted/50">
                    <span className="text-muted-foreground">플랫폼 수수료</span>
                    <span className="font-medium text-red-600">-{formatAmount(selectedHelper.platformFee)}</span>
                  </div>
                  <div className="flex justify-between p-3 hover:bg-muted/50">
                    <span className="text-muted-foreground">차감액 (분쟁/사고)</span>
                    <span className="font-medium text-red-600">-{formatAmount(selectedHelper.deductedAmount)}</span>
                  </div>
                  {selectedHelper.deductions > 0 && (
                    <div className="flex justify-between p-3 hover:bg-muted/50">
                      <span className="text-muted-foreground text-sm pl-4">└ 분쟁 차감</span>
                      <span className="font-medium text-sm text-red-600">-{formatAmount(selectedHelper.deductions)}</span>
                    </div>
                  )}
                  {selectedHelper.cargoIncident > 0 && (
                    <div className="flex justify-between p-3 hover:bg-muted/50">
                      <span className="text-muted-foreground text-sm pl-4">└ 화물사고 배상</span>
                      <span className="font-medium text-sm text-red-600">-{formatAmount(selectedHelper.cargoIncident)}</span>
                    </div>
                  )}
                  <div className="flex justify-between p-3 bg-green-50">
                    <span className="font-bold">최종 지급액</span>
                    <span className="font-bold text-xl text-green-600">{formatAmount(selectedHelper.driverPayout)}</span>
                  </div>
                </div>
              </div>

              {/* 액션 버튼 */}
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelectedHelper(null)}>
                  닫기
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDownloadStatement(selectedHelper)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  거래명세서
                </Button>
                <Button
                  onClick={async () => {
                    if (await confirm({ title: '정산 확정', description: `${selectedHelper.helperName} 헬퍼의 ${selectedYear}년 ${monthNames[selectedMonth]} 정산을 확정하시겠습니까?` })) {
                      confirmSettlementMutation.mutate(selectedHelper.helperId);
                    }
                  }}
                  disabled={confirmSettlementMutation.isPending}
                >
                  {confirmSettlementMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  정산 확정
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 입금 확인 모달 */}
      <Dialog open={showPaymentConfirm} onOpenChange={setShowPaymentConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>입금 확인 처리</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedRequester && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <div className="font-medium">{selectedRequester.requesterName} ({selectedRequester.businessName})</div>
                <div className="text-muted-foreground mt-1">
                  미수금액: <span className="font-medium text-orange-600">{formatAmount(selectedRequester.unpaidAmount)}</span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>결제 방법</Label>
              <Select value={paymentForm.paymentMethod} onValueChange={(v) => setPaymentForm({ ...paymentForm, paymentMethod: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">계좌이체</SelectItem>
                  <SelectItem value="card">카드결제</SelectItem>
                  <SelectItem value="cash">현금</SelectItem>
                  <SelectItem value="virtual_account">가상계좌</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>거래 번호 (선택)</Label>
              <Input
                placeholder="입금 거래 번호"
                value={paymentForm.transactionId}
                onChange={(e) => setPaymentForm({ ...paymentForm, transactionId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>입금 금액</Label>
              <Input
                type="number"
                placeholder="입금 금액"
                value={paymentForm.paidAmount}
                onChange={(e) => setPaymentForm({ ...paymentForm, paidAmount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>메모 (선택)</Label>
              <Textarea
                placeholder="입금 관련 메모"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPaymentConfirm(false)}>
              취소
            </Button>
            <Button
              onClick={() => {
                if (selectedRequester) {
                  markPaidMutation.mutate({
                    requesterId: selectedRequester.requesterId,
                    form: paymentForm,
                  });
                }
              }}
              disabled={markPaidMutation.isPending || !paymentForm.paidAmount}
            >
              {markPaidMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              입금 확인 처리
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 요청자 정산 상세 모달 */}
      <Dialog open={!!selectedRequester} onOpenChange={() => setSelectedRequester(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              요청자 정산 상세 - {selectedRequester?.requesterName} ({selectedYear}년 {monthNames[selectedMonth]})
            </DialogTitle>
          </DialogHeader>
          
          {selectedRequester && (
            <div className="space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">요청자명</div>
                  <div className="font-medium">{selectedRequester.requesterName}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">사업자명</div>
                  <div className="font-medium">{selectedRequester.businessName || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">연락처</div>
                  <div className="font-medium">{selectedRequester.requesterPhone}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">오더 수</div>
                  <div className="font-medium text-lg">{selectedRequester.orderCount}건</div>
                </div>
              </div>

              {/* 정산 상세 */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">청구 내역</h3>
                <div className="border rounded-lg divide-y">
                  <div className="flex justify-between p-3 hover:bg-muted/50 bg-blue-50">
                    <span className="font-semibold">총 청구금액</span>
                    <span className="font-bold text-blue-600">{formatAmount(selectedRequester.billedAmount)}</span>
                  </div>
                  <div className="flex justify-between p-3 hover:bg-muted/50">
                    <span className="text-muted-foreground">미수금액</span>
                    <span className="font-medium text-orange-600">{formatAmount(selectedRequester.unpaidAmount)}</span>
                  </div>
                  <div className="flex justify-between p-3 hover:bg-muted/50">
                    <span className="text-muted-foreground">입금 예정일</span>
                    <span className="font-medium">
                      {selectedRequester.paymentDate ? new Date(selectedRequester.paymentDate).toLocaleDateString('ko-KR') : '미정'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 미수금 안내 */}
              {selectedRequester.unpaidAmount > 0 && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div>
                      <div className="font-medium text-orange-900">미수금 확인 필요</div>
                      <div className="text-sm text-orange-700 mt-1">
                        {formatAmount(selectedRequester.unpaidAmount)}의 미수금이 있습니다.
                        입금 확인 후 정산을 완료해주세요.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 액션 버튼 */}
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelectedRequester(null)}>
                  닫기
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (await confirm({ title: '세금계산서 발행', description: `${selectedRequester.requesterName}님의 세금계산서를 발행하시겠습니까?` })) {
                      createTaxInvoiceMutation.mutate(selectedRequester.requesterId);
                    }
                  }}
                  disabled={createTaxInvoiceMutation.isPending}
                >
                  {createTaxInvoiceMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Receipt className="h-4 w-4 mr-2" />
                  )}
                  세금계산서 발행
                </Button>
                {selectedRequester.unpaidAmount > 0 && (
                  <Button
                    onClick={() => {
                      setPaymentForm({
                        ...paymentForm,
                        paidAmount: String(selectedRequester.unpaidAmount),
                      });
                      setShowPaymentConfirm(true);
                    }}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    입금 확인
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 일일 정산 상세 모달 */}
      <Dialog open={!!selectedDailySettlement} onOpenChange={() => setSelectedDailySettlement(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>일일 정산 상세</DialogTitle>
          </DialogHeader>
          {selectedDailySettlement && (
            <div className="space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">오더번호</div>
                  <div className="font-medium">#{selectedDailySettlement.orderId}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">정산 ID</div>
                  <div className="font-mono text-sm">#{selectedDailySettlement.id}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">헬퍼</div>
                  <div>
                    <div className="font-medium">{selectedDailySettlement.helperName || '-'}</div>
                    {selectedDailySettlement.helperPhone && (
                      <div className="text-xs text-muted-foreground">{selectedDailySettlement.helperPhone}</div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">요청자</div>
                  <div className="font-medium">{selectedDailySettlement.requesterName || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">카테고리</div>
                  <Badge variant="outline">
                    {CATEGORY_LABELS[selectedDailySettlement.category || ''] || selectedDailySettlement.category || '-'}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">운송사</div>
                  <div className="font-medium">{selectedDailySettlement.courierCompany || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">정산일</div>
                  <div className="font-medium">{new Date(selectedDailySettlement.createdAt).toLocaleDateString('ko-KR')}</div>
                </div>
              </div>

              {/* 배송 수량 */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">배송 수량</h3>
                <div className="border rounded-lg divide-y">
                  <div className="flex justify-between p-3 hover:bg-muted/50">
                    <span className="text-muted-foreground">배송 완료</span>
                    <span className="font-medium">{selectedDailySettlement.deliveredCount}건</span>
                  </div>
                  <div className="flex justify-between p-3 hover:bg-muted/50">
                    <span className="text-muted-foreground">반품</span>
                    <span className="font-medium">{selectedDailySettlement.returnedCount}건</span>
                  </div>
                  <div className="flex justify-between p-3 hover:bg-muted/50">
                    <span className="text-muted-foreground">기타</span>
                    <span className="font-medium">{selectedDailySettlement.etcCount}건</span>
                  </div>
                  <div className="flex justify-between p-3 hover:bg-muted/50">
                    <span className="text-muted-foreground">건당 단가</span>
                    <span className="font-medium">{formatAmount(selectedDailySettlement.pricePerBox)}</span>
                  </div>
                </div>
              </div>

              {/* 추가 비용 */}
              {selectedDailySettlement.extraCostsJson && selectedDailySettlement.extraCostsJson.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">추가 비용</h3>
                  <div className="border rounded-lg divide-y">
                    {selectedDailySettlement.extraCostsJson.map((item, idx) => (
                      <div key={idx} className="flex justify-between p-3 hover:bg-muted/50">
                        <span className="text-muted-foreground">{item.name} (x{item.quantity})</span>
                        <span className="font-medium">{formatAmount(item.unitPrice * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 정산 내역 */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">정산 내역</h3>
                <div className="border rounded-lg divide-y">
                  <div className="flex justify-between p-3 hover:bg-muted/50 bg-blue-50">
                    <span className="font-semibold">최종 금액</span>
                    <span className="font-bold text-blue-600">{formatAmount(selectedDailySettlement.finalTotal)}</span>
                  </div>
                  <div className="flex justify-between p-3 hover:bg-muted/50">
                    <span className="text-muted-foreground">플랫폼 수수료</span>
                    <span className="font-medium text-red-600">-{formatAmount(selectedDailySettlement.platformFee)}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-green-50">
                    <span className="font-bold">헬퍼 지급액</span>
                    <span className="font-bold text-xl text-green-600">{formatAmount(selectedDailySettlement.driverPayout)}</span>
                  </div>
                </div>
              </div>

              {/* 마감 메모 */}
              {selectedDailySettlement.closingMemo && (
                <div>
                  <p className="text-sm text-muted-foreground">마감 메모</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{selectedDailySettlement.closingMemo}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDailySettlement(null)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
