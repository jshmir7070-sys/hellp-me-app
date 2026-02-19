import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FileText, CheckCircle, XCircle, Clock, AlertCircle, Eye, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, getAuthHeaders } from '@/lib/api';

interface DocumentData {
  id: number;
  userId: string;
  documentType: 'businessCert' | 'driverLicense' | 'cargoLicense' | 'vehicleCert' | 'transportContract';
  status: 'not_submitted' | 'pending' | 'reviewing' | 'approved' | 'rejected';
  imageUrl?: string;
  businessNumber?: string;
  businessName?: string;
  representativeName?: string;
  businessAddress?: string;
  businessType?: string;
  businessCategory?: string;
  licenseNumber?: string;
  licenseType?: string;
  issueDate?: string;
  expiryDate?: string;
  plateNumber?: string;
  vehicleType?: string;
  vehicleOwnerName?: string;
  contractCompanyName?: string;
  contractDate?: string;
  signatureName?: string;
  verificationPhone?: string;
  contractConsent?: string; // JSON string
  uploadedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

interface UserInfo {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
}

interface DocumentWithUser {
  document: DocumentData;
  user: UserInfo;
}

const DOCUMENT_TYPE_LABELS = {
  businessCert: '사업자등록증',
  driverLicense: '운전면허증',
  cargoLicense: '화물운송종사자격증',
  vehicleCert: '차량등록증',
  transportContract: '용달계약서',
};

const STATUS_CONFIG = {
  not_submitted: {
    label: '미제출',
    color: 'gray',
    icon: AlertCircle,
  },
  pending: {
    label: '검토대기',
    color: 'yellow',
    icon: Clock,
  },
  reviewing: {
    label: '검토중',
    color: 'blue',
    icon: Eye,
  },
  approved: {
    label: '승인완료',
    color: 'green',
    icon: CheckCircle,
  },
  rejected: {
    label: '반려됨',
    color: 'red',
    icon: XCircle,
  },
};

export default function HelperDocumentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [filters, setFilters] = useState({
    status: 'all',
    documentType: 'all',
    search: '',
  });
  
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithUser | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailDocument, setDetailDocument] = useState<DocumentWithUser | null>(null);
  const [detailImageUrl, setDetailImageUrl] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');
  const [adminNote, setAdminNote] = useState('');

  // 서류 목록 조회
  const { data: documents = [], isLoading } = useQuery<DocumentWithUser[]>({
    queryKey: ['/api/admin/helper-documents', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.documentType !== 'all') params.append('documentType', filters.documentType);

      return apiRequest<DocumentWithUser[]>(`/helper-documents?${params.toString()}`);
    },
  });

  // 승인 mutation
  const approveMutation = useMutation({
    mutationFn: async ({ id, adminNote }: { id: number; adminNote: string }) => {
      return apiRequest(`/helper-documents/${id}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ adminNote }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/helper-documents'] });
      toast({ title: '성공', description: '서류가 승인되었습니다', variant: 'success' });
      setShowReviewDialog(false);
      setSelectedDocument(null);
    },
    onError: () => {
      toast({ title: '오류', description: '승인 처리에 실패했습니다', variant: 'error' });
    },
  });

  // 반려 mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, rejectionReason, adminNote }: { id: number; rejectionReason: string; adminNote: string }) => {
      return apiRequest(`/helper-documents/${id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ rejectionReason, adminNote }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/helper-documents'] });
      toast({ title: '성공', description: '서류가 반려되었습니다', variant: 'success' });
      setShowReviewDialog(false);
      setSelectedDocument(null);
    },
    onError: () => {
      toast({ title: '오류', description: '반려 처리에 실패했습니다', variant: 'error' });
    },
  });

  const handleReviewSubmit = () => {
    if (!selectedDocument) return;

    if (reviewAction === 'approve') {
      approveMutation.mutate({
        id: selectedDocument.document.id,
        adminNote,
      });
    } else {
      if (!rejectionReason.trim()) {
        toast({ title: '알림', description: '반려 사유를 입력해주세요', variant: 'warning' });
        return;
      }
      rejectMutation.mutate({
        id: selectedDocument.document.id,
        rejectionReason,
        adminNote,
      });
    }
  };

  // 전체 승인
  const approveAllMutation = useMutation({
    mutationFn: async (documentIds: number[]) => {
      // 모든 서류를 순차적으로 승인
      for (const id of documentIds) {
        await apiRequest(`/helper-documents/${id}/approve`, {
          method: 'PATCH',
          body: JSON.stringify({ adminNote: '일괄 승인' }),
          headers: { 'Content-Type': 'application/json' },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/helper-documents'] });
      toast({ title: '승인 완료', description: '모든 서류가 승인되었습니다', variant: 'success' });
    },
    onError: () => {
      toast({ title: '오류', description: '일부 서류 승인에 실패했습니다', variant: 'error' });
    },
  });

  const handleApproveAll = (documents: DocumentData[]) => {
    const reviewingDocs = documents.filter(d => d.status === 'reviewing' || d.status === 'pending');
    if (reviewingDocs.length === 0) {
      toast({ title: '알림', description: '승인할 서류가 없습니다' });
      return;
    }

    if (confirm(`${reviewingDocs.length}개의 서류를 모두 승인하시겠습니까?`)) {
      approveAllMutation.mutate(reviewingDocs.map(d => d.id));
    }
  };

  const openReviewDialog = (doc: DocumentWithUser, action: 'approve' | 'reject') => {
    setSelectedDocument(doc);
    setReviewAction(action);
    setRejectionReason('');
    setAdminNote('');
    setShowReviewDialog(true);
  };

  // 서류 상세보기 열기
  const openDetailDialog = async (doc: DocumentWithUser) => {
    setDetailDocument(doc);
    setDetailImageUrl(null);
    setShowDetailDialog(true);

    // 이미지가 있으면 토큰과 함께 가져오기
    if (doc.document.imageUrl) {
      try {
        const headers = getAuthHeaders();
        const response = await fetch(doc.document.imageUrl, { headers });
        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          setDetailImageUrl(url);
        }
      } catch (err) {
        console.error('Image load error:', err);
      }
    }
  };

  // cleanup blob URL
  useEffect(() => {
    return () => {
      if (detailImageUrl) URL.revokeObjectURL(detailImageUrl);
    };
  }, [detailImageUrl]);

  // 서류 타입별 상세 정보 렌더링
  const renderDocumentDetails = (doc: DocumentData) => {
    const details: { label: string; value: string | undefined }[] = [];

    switch (doc.documentType) {
      case 'businessCert':
        details.push(
          { label: '사업자번호', value: doc.businessNumber },
          { label: '상호명', value: doc.businessName },
          { label: '대표자명', value: doc.representativeName },
          { label: '사업장주소', value: doc.businessAddress },
          { label: '업종', value: doc.businessType },
          { label: '업태', value: doc.businessCategory },
        );
        break;
      case 'driverLicense':
        details.push(
          { label: '면허번호', value: doc.licenseNumber },
          { label: '면허종류', value: doc.licenseType },
          { label: '발급일', value: doc.issueDate },
          { label: '만료일', value: doc.expiryDate },
        );
        break;
      case 'cargoLicense':
        details.push(
          { label: '자격증번호', value: doc.licenseNumber },
          { label: '발급일', value: doc.issueDate },
        );
        break;
      case 'vehicleCert':
        details.push(
          { label: '차량번호', value: doc.plateNumber },
          { label: '차량종류', value: doc.vehicleType },
          { label: '소유자명', value: doc.vehicleOwnerName },
        );
        break;
      case 'transportContract':
        details.push(
          { label: '계약회사명', value: doc.contractCompanyName },
          { label: '계약일', value: doc.contractDate },
          { label: '서명자명', value: doc.signatureName },
          { label: '확인전화번호', value: doc.verificationPhone },
        );

        // 동의 사항 파싱
        if (doc.contractConsent) {
          try {
            const consent = JSON.parse(doc.contractConsent);
            let agreedAtStr = '-';
            if (consent.agreedAt) {
              try {
                agreedAtStr = new Date(consent.agreedAt).toLocaleString('ko-KR');
              } catch {
                agreedAtStr = String(consent.agreedAt);
              }
            }
            details.push(
              { label: '위수탁 계약 동의', value: consent.agreeConsignment ? '✓ 동의함' : '✗ 미동의' },
              { label: '안전교육 이수 동의', value: consent.agreeSafety ? '✓ 동의함' : '✗ 미동의' },
              { label: '개인정보 수집 동의', value: consent.agreePrivacy ? '✓ 동의함' : '✗ 미동의' },
              { label: '동의 일시', value: agreedAtStr },
            );
          } catch (e) {
            console.error('Failed to parse contract consent:', e);
            // 파싱 실패해도 기본 정보는 표시
          }
        }
        break;
    }

    return details.filter(d => d.value);
  };

  // 필터링된 문서
  const filteredDocuments = documents.filter(item => {
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return (
        item.user.name.toLowerCase().includes(search) ||
        item.user.email.toLowerCase().includes(search) ||
        item.user.phoneNumber?.includes(search) ||
        item.document.businessNumber?.includes(search) ||
        item.document.licenseNumber?.includes(search) ||
        item.document.plateNumber?.includes(search)
      );
    }
    return true;
  });

  // 헬퍼별로 그룹핑
  const groupedByHelper = filteredDocuments.reduce((acc, item) => {
    const userId = item.user.id;
    if (!acc[userId]) {
      acc[userId] = {
        user: item.user,
        documents: []
      };
    }
    acc[userId].documents.push(item.document);
    return acc;
  }, {} as Record<string, { user: UserInfo; documents: DocumentData[] }>);

  const helpers = Object.values(groupedByHelper);

  // 통계
  const stats = {
    total: documents.length,
    pending: documents.filter(d => d.document.status === 'pending' || d.document.status === 'reviewing').length,
    approved: documents.filter(d => d.document.status === 'approved').length,
    rejected: documents.filter(d => d.document.status === 'rejected').length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">헬퍼 서류 검토</h1>
        <p className="text-muted-foreground mt-1">
          헬퍼가 제출한 서류를 검토하고 승인/반려 처리합니다
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">전체 서류</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-sm text-muted-foreground">검토대기</p>
              <p className="text-2xl font-bold">{stats.pending}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">승인완료</p>
              <p className="text-2xl font-bold">{stats.approved}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-sm text-muted-foreground">반려</p>
              <p className="text-2xl font-bold">{stats.rejected}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* 필터 */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="status-filter">상태</Label>
            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
              <SelectTrigger id="status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="reviewing">검토중</SelectItem>
                <SelectItem value="approved">승인완료</SelectItem>
                <SelectItem value="rejected">반려됨</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="doc-type-filter">서류 종류</Label>
            <Select value={filters.documentType} onValueChange={(v) => setFilters({ ...filters, documentType: v })}>
              <SelectTrigger id="doc-type-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="businessCert">사업자등록증</SelectItem>
                <SelectItem value="driverLicense">운전면허증</SelectItem>
                <SelectItem value="cargoLicense">화물운송종사자격증</SelectItem>
                <SelectItem value="vehicleCert">차량등록증</SelectItem>
                <SelectItem value="transportContract">용달계약서</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="md:col-span-2">
            <Label htmlFor="search">검색</Label>
            <Input
              id="search"
              placeholder="헬퍼명, 이메일, 전화번호, 사업자번호 등"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
        </div>
      </Card>

      {/* 헬퍼별 서류 목록 - 테이블 형식 */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">로딩중...</div>
        ) : helpers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">서류가 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-4 py-3 text-left text-sm font-semibold">이름</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">이메일</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">사업자<br/>등록증</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">운전<br/>면허증</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">화물운송<br/>자격증</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">차량<br/>등록증</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">용달<br/>계약서</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">액션</th>
                </tr>
              </thead>
              <tbody>
                {helpers.map(({ user, documents: helperDocs }) => {
                  const allDocTypes = ['businessCert', 'driverLicense', 'cargoLicense', 'vehicleCert', 'transportContract'] as const;
                  const reviewingCount = helperDocs.filter(d => d.status === 'reviewing' || d.status === 'pending').length;

                  return (
                    <tr key={user.id} className="border-b hover:bg-muted/20 transition-colors">
                      {/* 이름 */}
                      <td className="px-4 py-3">
                        <div className="font-medium">{user.name}</div>
                        {user.phoneNumber && (
                          <div className="text-xs text-muted-foreground">{user.phoneNumber}</div>
                        )}
                      </td>

                      {/* 이메일 */}
                      <td className="px-4 py-3">
                        <div className="text-sm">{user.email}</div>
                      </td>

                      {/* 서류 아이콘들 */}
                      {allDocTypes.map(docType => {
                        const doc = helperDocs.find(d => d.documentType === docType);
                        const status = doc?.status || 'not_submitted';

                        return (
                          <td key={docType} className="px-4 py-3 text-center">
                            {doc && status !== 'not_submitted' ? (
                              <button
                                onClick={() => openDetailDialog({ document: doc, user })}
                                className="inline-flex items-center justify-center p-2 rounded-lg hover:bg-muted transition-colors"
                                title={`${DOCUMENT_TYPE_LABELS[docType]} - ${STATUS_CONFIG[status].label}`}
                              >
                                {status === 'approved' ? (
                                  <CheckCircle className="h-6 w-6 text-green-600" />
                                ) : status === 'rejected' ? (
                                  <XCircle className="h-6 w-6 text-red-600" />
                                ) : status === 'reviewing' ? (
                                  <Eye className="h-6 w-6 text-blue-600" />
                                ) : (
                                  <Clock className="h-6 w-6 text-yellow-600" />
                                )}
                              </button>
                            ) : (
                              <div className="inline-flex items-center justify-center p-2">
                                <AlertCircle className="h-6 w-6 text-gray-300" />
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* 액션 버튼 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          {reviewingCount > 0 && (
                            <Button
                              size="sm"
                              onClick={() => handleApproveAll(helperDocs)}
                              disabled={approveAllMutation.isPending}
                              className="bg-green-600 hover:bg-green-700 text-white"
                              title="전체 승인"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`/admin/helpers/${user.id}`, '_blank')}
                            title="헬퍼 상세"
                          >
                            <User className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 서류 상세보기 다이얼로그 */}
      <Dialog open={showDetailDialog} onOpenChange={(open) => {
        setShowDetailDialog(open);
        if (!open && detailImageUrl) {
          URL.revokeObjectURL(detailImageUrl);
          setDetailImageUrl(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              서류 상세 정보
            </DialogTitle>
          </DialogHeader>

          {detailDocument && (
            <div className="space-y-4">
              {/* 헬퍼 정보 */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">헬퍼명</p>
                  <p className="font-medium">{detailDocument.user.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">이메일</p>
                  <p className="font-medium text-sm">{detailDocument.user.email}</p>
                </div>
                {detailDocument.user.phoneNumber && (
                  <div>
                    <p className="text-xs text-muted-foreground">전화번호</p>
                    <p className="font-medium">{detailDocument.user.phoneNumber}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">서류 종류</p>
                  <Badge variant="outline">
                    {DOCUMENT_TYPE_LABELS[detailDocument.document.documentType]}
                  </Badge>
                </div>
              </div>

              {/* 상태 */}
              <div className="flex items-center gap-2">
                {(() => {
                  const StatusIcon = STATUS_CONFIG[detailDocument.document.status].icon;
                  return (
                    <>
                      <StatusIcon className={`h-5 w-5 text-${STATUS_CONFIG[detailDocument.document.status].color}-500`} />
                      <span className="font-medium">{STATUS_CONFIG[detailDocument.document.status].label}</span>
                    </>
                  );
                })()}
                {detailDocument.document.uploadedAt && (
                  <span className="text-sm text-muted-foreground ml-auto">
                    제출: {format(new Date(detailDocument.document.uploadedAt), 'yyyy-MM-dd HH:mm', { locale: ko })}
                  </span>
                )}
              </div>

              {/* 반려 사유 */}
              {detailDocument.document.status === 'rejected' && detailDocument.document.rejectionReason && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-800">반려 사유</p>
                  <p className="text-sm text-red-700">{detailDocument.document.rejectionReason}</p>
                </div>
              )}

              {/* 서류 타입별 상세 정보 */}
              {renderDocumentDetails(detailDocument.document).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">입력 정보</p>
                  <div className="grid grid-cols-2 gap-3 p-3 border rounded-lg">
                    {renderDocumentDetails(detailDocument.document).map((detail, idx) => (
                      <div key={idx}>
                        <p className="text-xs text-muted-foreground">{detail.label}</p>
                        <p className="text-sm font-medium">{detail.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 화물위탁계약서 전문 */}
              {detailDocument.document.documentType === 'transportContract' && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium mb-3 text-blue-900">화물자동차 운송사업 위수탁 계약서</p>
                  <div className="space-y-3 text-xs text-gray-700 max-h-[400px] overflow-y-auto">
                    <p className="font-medium">
                      본 계약은 「화물자동차 운수사업법」 제29조 및 같은 법 시행규칙 제28조에 따라,
                      화물자동차 운송사업의 위수탁에 관한 사항을 정하기 위하여 체결합니다.
                    </p>

                    <div className="mt-3">
                      <p className="font-semibold mb-1">제1조 (목적)</p>
                      <p>본 계약은 위탁자와 수탁자 간의 화물자동차 운송사업의 위탁 및 수탁에 관한 사항을 명확히 하여,
                      상호 신뢰를 바탕으로 한 거래질서를 확립하고자 함을 목적으로 합니다.</p>
                    </div>

                    <div>
                      <p className="font-semibold mb-1">제2조 (위탁 범위)</p>
                      <p>① 위탁자는 수탁자에게 다음 각 호의 업무를 위탁하며, 수탁자는 이를 성실히 수행합니다.</p>
                      <p className="ml-3">1. 화물의 집하, 운송 및 배송</p>
                      <p className="ml-3">2. 화물의 적재 및 하역</p>
                      <p className="ml-3">3. 기타 운송에 부수되는 업무</p>
                    </div>

                    <div>
                      <p className="font-semibold mb-1">제3조 (수탁자의 의무)</p>
                      <p>① 수탁자는 관계법령을 준수하며 화물을 안전하게 운송할 의무가 있습니다.</p>
                      <p>② 수탁자는 운송 중 발생한 사고에 대하여 책임을 집니다.</p>
                      <p>③ 수탁자는 위탁자의 영업비밀을 보호하여야 합니다.</p>
                    </div>

                    <div>
                      <p className="font-semibold mb-1">제4조 (위탁자의 의무)</p>
                      <p>① 위탁자는 수탁자에게 운송에 필요한 정보를 제공하여야 합니다.</p>
                      <p>② 위탁자는 계약에 따른 운송료를 지급할 의무가 있습니다.</p>
                    </div>

                    <div>
                      <p className="font-semibold mb-1">제5조 (운송료 및 지급)</p>
                      <p>운송료는 앱 내에서 합의된 금액으로 하며, 작업 완료 후 정산 절차에 따라 지급됩니다.</p>
                    </div>

                    <div>
                      <p className="font-semibold mb-1">제6조 (계약 기간)</p>
                      <p>본 계약의 유효기간은 계약 체결일로부터 1년으로 하며, 별도의 해지 의사표시가 없는 한 자동으로 연장됩니다.</p>
                    </div>

                    <div>
                      <p className="font-semibold mb-1">제7조 (손해배상)</p>
                      <p>양 당사자는 본 계약의 이행과 관련하여 상대방에게 손해를 입힌 경우 이를 배상하여야 합니다.</p>
                    </div>

                    <div className="mt-4 p-3 bg-white rounded border border-blue-300">
                      <p className="font-semibold text-blue-900 mb-2">헬퍼 동의 사항</p>
                      <p className="text-xs">
                        ✓ 위 계약 내용을 모두 확인하였으며 이에 동의합니다.<br/>
                        ✓ 안전 교육을 이수하였으며 관련 규정을 준수하겠습니다.<br/>
                        ✓ 개인정보 수집 및 이용에 동의합니다.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 이미지 */}
              {detailDocument.document.imageUrl && (
                <div>
                  <p className="text-sm font-medium mb-2">제출 이미지</p>
                  <div className="border rounded-lg overflow-hidden bg-gray-50">
                    {detailImageUrl ? (
                      <img
                        src={detailImageUrl}
                        alt="제출 서류"
                        className="w-full max-h-[500px] object-contain"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-48 text-muted-foreground">
                        이미지 로딩중...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 관리자 메모 */}
              {detailDocument.document.adminNote && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800">관리자 메모</p>
                  <p className="text-sm text-blue-700">{detailDocument.document.adminNote}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {detailDocument && (detailDocument.document.status === 'reviewing' || detailDocument.document.status === 'pending') && (
              <>
                <Button
                  variant="default"
                  onClick={() => {
                    setShowDetailDialog(false);
                    openReviewDialog(detailDocument, 'approve');
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  승인
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowDetailDialog(false);
                    openReviewDialog(detailDocument, 'reject');
                  }}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  반려
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 검토 다이얼로그 */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'approve' ? '서류 승인' : '서류 반려'}
            </DialogTitle>
          </DialogHeader>

          {selectedDocument && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">헬퍼</p>
                <p className="font-medium">{selectedDocument.user.name}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">서류 종류</p>
                <p className="font-medium">{DOCUMENT_TYPE_LABELS[selectedDocument.document.documentType]}</p>
              </div>

              {reviewAction === 'reject' && (
                <div>
                  <Label htmlFor="rejection-reason">반려 사유 *</Label>
                  <Textarea
                    id="rejection-reason"
                    placeholder="반려 사유를 입력해주세요"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                  />
                </div>
              )}

              <div>
                <Label htmlFor="admin-note">관리자 메모 (선택)</Label>
                <Textarea
                  id="admin-note"
                  placeholder="내부 메모를 입력하세요"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
              취소
            </Button>
            <Button
              onClick={handleReviewSubmit}
              disabled={approveMutation.isPending || rejectMutation.isPending}
            >
              {reviewAction === 'approve' ? '승인' : '반려'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
