import { useState } from 'react';
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
import { apiRequest } from '@/lib/api';

interface DocumentData {
  id: number;
  userId: string;
  documentType: 'businessCert' | 'driverLicense' | 'cargoLicense' | 'vehicleCert' | 'transportContract';
  status: 'not_submitted' | 'pending' | 'reviewing' | 'approved' | 'rejected';
  imageUrl?: string;
  businessNumber?: string;
  businessName?: string;
  representativeName?: string;
  licenseNumber?: string;
  licenseType?: string;
  issueDate?: string;
  expiryDate?: string;
  plateNumber?: string;
  vehicleType?: string;
  vehicleOwnerName?: string;
  contractCompanyName?: string;
  contractDate?: string;
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
      toast({ title: '성공', description: '서류가 승인되었습니다' });
      setShowReviewDialog(false);
      setSelectedDocument(null);
    },
    onError: () => {
      toast({ title: '오류', description: '승인 처리에 실패했습니다', variant: 'destructive' });
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
      toast({ title: '성공', description: '서류가 반려되었습니다' });
      setShowReviewDialog(false);
      setSelectedDocument(null);
    },
    onError: () => {
      toast({ title: '오류', description: '반려 처리에 실패했습니다', variant: 'destructive' });
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
        toast({ title: '알림', description: '반려 사유를 입력해주세요', variant: 'destructive' });
        return;
      }
      rejectMutation.mutate({
        id: selectedDocument.document.id,
        rejectionReason,
        adminNote,
      });
    }
  };

  const openReviewDialog = (doc: DocumentWithUser, action: 'approve' | 'reject') => {
    setSelectedDocument(doc);
    setReviewAction(action);
    setRejectionReason('');
    setAdminNote('');
    setShowReviewDialog(true);
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

      {/* 서류 목록 */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="p-3 text-left font-medium">헬퍼</th>
                <th className="p-3 text-left font-medium">서류 종류</th>
                <th className="p-3 text-left font-medium">상태</th>
                <th className="p-3 text-left font-medium">제출일시</th>
                <th className="p-3 text-left font-medium">검토일시</th>
                <th className="p-3 text-center font-medium">작업</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    로딩중...
                  </td>
                </tr>
              ) : filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    서류가 없습니다
                  </td>
                </tr>
              ) : (
                filteredDocuments.map((item) => {
                  const StatusIcon = STATUS_CONFIG[item.document.status].icon;
                  return (
                    <tr key={item.document.id} className="border-b hover:bg-muted/50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{item.user.name}</p>
                            <p className="text-xs text-muted-foreground">{item.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">
                          {DOCUMENT_TYPE_LABELS[item.document.documentType]}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <StatusIcon className={`h-4 w-4 text-${STATUS_CONFIG[item.document.status].color}-500`} />
                          <span>{STATUS_CONFIG[item.document.status].label}</span>
                        </div>
                      </td>
                      <td className="p-3 text-sm">
                        {item.document.uploadedAt
                          ? format(new Date(item.document.uploadedAt), 'yyyy-MM-dd HH:mm', { locale: ko })
                          : '-'}
                      </td>
                      <td className="p-3 text-sm">
                        {item.document.reviewedAt
                          ? format(new Date(item.document.reviewedAt), 'yyyy-MM-dd HH:mm', { locale: ko })
                          : '-'}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          {item.document.imageUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(item.document.imageUrl, '_blank')}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              보기
                            </Button>
                          )}
                          {(item.document.status === 'reviewing' || item.document.status === 'pending') && (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => openReviewDialog(item, 'approve')}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                승인
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => openReviewDialog(item, 'reject')}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                반려
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

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
