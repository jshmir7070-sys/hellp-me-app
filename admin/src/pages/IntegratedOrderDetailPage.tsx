/**
 * Integrated Order Detail Page - 재설계 버전
 * 통합 오더 상세 - 모든 정보를 한 화면에
 *
 * 개선사항:
 * - PageHeader 컴포넌트 적용
 * - StatusBadge로 상태 표시 표준화
 * - 카드 hover 효과 추가
 * - 타임라인 UI 개선
 * - EmptyState 컴포넌트 사용
 * - 반응형 그리드 개선
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useIntegratedOrder } from '@/hooks/useIntegratedOrder';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Package,
  User,
  Truck,
  DollarSign,
  MapPin,
  Calendar,
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Camera,
  Users,
  Loader2,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: '승인 대기', color: 'bg-yellow-500' },
  confirmed: { label: '승인 완료', color: 'bg-blue-500' },
  in_progress: { label: '진행 중', color: 'bg-green-500' },
  completed: { label: '완료', color: 'bg-gray-500' },
  cancelled: { label: '취소됨', color: 'bg-red-500' },
};

const SETTLEMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending_approval: { label: '승인 대기', color: 'bg-yellow-500' },
  approved: { label: '승인 완료', color: 'bg-blue-500' },
  paid: { label: '지급 완료', color: 'bg-green-500' },
  rejected: { label: '거부됨', color: 'bg-red-500' },
};

export default function IntegratedOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useIntegratedOrder(orderId!);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['integrated-order', orderId] });
    toast({ title: '오더 정보를 새로고침했습니다.' });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'PPP p', { locale: ko });
    } catch {
      return dateString;
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">오더 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data?.success) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="오더 상세"
          description="오더를 불러올 수 없습니다"
          actions={
            <Button variant="outline" size="sm" onClick={() => navigate('/orders')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              목록으로
            </Button>
          }
        />
        <EmptyState
          icon={<AlertCircle className="h-12 w-12 text-destructive" />}
          title="오더를 불러올 수 없습니다"
          description={(error as Error)?.message || '다시 시도해주세요'}
        />
      </div>
    );
  }

  const { order, contract, settlements, checkins, closing, applications } = data.data;
  const orderStatus = ORDER_STATUS_CONFIG[order.status] || { label: order.status, color: 'bg-gray-500' };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={`오더 #${order.id}`}
        description={`생성: ${formatDate(order.createdAt)}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/orders')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              목록으로
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              새로고침
            </Button>
          </>
        }
      >
        <div className="flex items-center gap-2 mt-2">
          {order.isUrgent && (
            <Badge variant="destructive">긴급</Badge>
          )}
          <StatusBadge status={order.status} label={orderStatus.label} size="md" />
        </div>
      </PageHeader>

      {/* 3컬럼 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 오더 기본 정보 */}
        <div className="space-y-6">
          {/* 의뢰자 정보 */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-5 w-5 text-blue-500" />
                의뢰자 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase">이름</div>
                <div className="text-sm font-medium mt-1">{order.requesterName}</div>
              </div>
              <Separator />
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase">연락처</div>
                <div className="text-sm mt-1 flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {order.requesterPhone}
                </div>
              </div>
              <Separator />
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase">이메일</div>
                <div className="text-sm mt-1">{order.requesterEmail}</div>
              </div>
            </CardContent>
          </Card>

          {/* 헬퍼 정보 */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-5 w-5 text-green-500" />
                헬퍼 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.helperName ? (
                <>
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase">이름</div>
                    <div className="text-sm font-medium mt-1">{order.helperName}</div>
                  </div>
                  {order.helperTeamName && (
                    <>
                      <Separator />
                      <div>
                        <div className="text-xs font-medium text-muted-foreground uppercase">팀</div>
                        <div className="text-sm mt-1">
                          <Badge variant="outline">{order.helperTeamName}</Badge>
                        </div>
                      </div>
                    </>
                  )}
                  <Separator />
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase">연락처</div>
                    <div className="text-sm mt-1 flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {order.helperPhone}
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={<Truck className="h-8 w-8 text-muted-foreground" />}
                  title="헬퍼 미배정"
                  description="아직 헬퍼가 배정되지 않았습니다"
                />
              )}
            </CardContent>
          </Card>

          {/* 배송 정보 */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-5 w-5 text-red-500" />
                배송 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase">배송 지역</div>
                <div className="text-sm font-medium mt-1">{order.deliveryArea}</div>
              </div>
              <Separator />
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase">캠프 주소</div>
                <div className="text-sm mt-1">{order.campAddress}</div>
              </div>
              <Separator />
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase">택배사</div>
                <div className="text-sm mt-1">
                  <Badge>{order.courierCompany}</Badge>
                </div>
              </div>
              <Separator />
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase">업체명</div>
                <div className="text-sm mt-1">{order.companyName}</div>
              </div>
              <Separator />
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase">연락처</div>
                <div className="text-sm mt-1">{order.contactPhone}</div>
              </div>
              {order.deliveryGuide && (
                <>
                  <Separator />
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase">배송 안내</div>
                    <div className="text-sm mt-1 whitespace-pre-wrap bg-muted p-3 rounded-md">
                      {order.deliveryGuide}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 오더 상세 */}
          <Card className="hover:shadow-lg transition-shadow border-primary/20">
            <CardHeader className="bg-primary/5">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-5 w-5 text-primary" />
                오더 상세
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-muted-foreground uppercase">박스 수</span>
                <span className="text-lg font-bold">{order.boxCount}개</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-muted-foreground uppercase">단가</span>
                <span className="text-sm font-medium">{formatMoney(order.unitPrice)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center bg-primary/5 p-3 rounded-lg">
                <span className="text-sm font-bold">총 금액</span>
                <span className="text-xl font-bold text-primary">{formatMoney(order.totalAmount)}</span>
              </div>
              <Separator />
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase mb-2">예정일</div>
                <div className="text-sm flex items-center gap-2 bg-muted p-2 rounded-md">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  {formatDate(order.scheduledDate)}
                </div>
              </div>
              {order.deadline && (
                <>
                  <Separator />
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase mb-2">마감 기한</div>
                    <div className="text-sm flex items-center gap-2 bg-orange-50 p-2 rounded-md">
                      <Clock className="h-4 w-4 text-orange-500" />
                      {formatDate(order.deadline)}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 가운데: 타임라인 + 체크인/마감 */}
        <div className="space-y-6">
          {/* 계약 정보 */}
          {contract && (
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-5 w-5 text-purple-500" />
                  계약 정보
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase mb-2">계약 상태</div>
                  <StatusBadge status={contract.status} size="md" />
                </div>
                {contract.helperSignedAt && (
                  <>
                    <Separator />
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase mb-2">헬퍼 서명</div>
                      <div className="text-sm flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        {formatDate(contract.helperSignedAt)}
                      </div>
                    </div>
                  </>
                )}
                {contract.requesterSignedAt && (
                  <>
                    <Separator />
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase mb-2">의뢰자 서명</div>
                      <div className="text-sm flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        {formatDate(contract.requesterSignedAt)}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* 체크인 정보 */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Camera className="h-5 w-5 text-cyan-500" />
                체크인 ({checkins.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {checkins.length > 0 ? (
                <div className="space-y-4">
                  {checkins.map((checkin, index) => (
                    <div key={checkin.id} className="relative">
                      {/* Timeline line */}
                      {index !== checkins.length - 1 && (
                        <div className="absolute left-2 top-8 bottom-0 w-0.5 bg-gradient-to-b from-primary to-transparent" />
                      )}

                      <div className="flex gap-3">
                        <div className="relative flex-shrink-0">
                          <div className="w-4 h-4 rounded-full bg-primary border-4 border-background" />
                        </div>
                        <div className="flex-1 bg-muted p-3 rounded-lg">
                          <div className="text-sm font-medium text-primary mb-1">
                            {formatDate(checkin.checkedInAt)}
                          </div>
                          {checkin.location && (
                            <div className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                              <MapPin className="h-3 w-3" />
                              {checkin.location}
                            </div>
                          )}
                          {checkin.notes && (
                            <div className="text-sm bg-background p-2 rounded mt-2">{checkin.notes}</div>
                          )}
                          {checkin.photoUrl && (
                            <img
                              src={checkin.photoUrl}
                              alt="체크인 사진"
                              className="mt-2 rounded-lg max-w-full h-auto border"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Camera className="h-8 w-8 text-muted-foreground" />}
                  title="체크인 없음"
                  description="아직 체크인 기록이 없습니다"
                />
              )}
            </CardContent>
          </Card>

          {/* 마감 정보 */}
          {closing && (
            <Card className="hover:shadow-lg transition-shadow border-green-200">
              <CardHeader className="bg-green-50">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  마감 정보
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-6">
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase mb-2">마감 상태</div>
                  <StatusBadge status={closing.status} size="md" />
                </div>
                {closing.actualBoxCount && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-muted-foreground uppercase">실제 박스 수</span>
                      <span className="text-sm font-bold">{closing.actualBoxCount}개</span>
                    </div>
                  </>
                )}
                {closing.actualWorkTime && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-muted-foreground uppercase">실제 작업 시간</span>
                      <span className="text-sm font-bold">{closing.actualWorkTime}분</span>
                    </div>
                  </>
                )}
                {closing.helperNotes && (
                  <>
                    <Separator />
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase mb-2">헬퍼 메모</div>
                      <div className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">{closing.helperNotes}</div>
                    </div>
                  </>
                )}
                {closing.requesterNotes && (
                  <>
                    <Separator />
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase mb-2">의뢰자 메모</div>
                      <div className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">{closing.requesterNotes}</div>
                    </div>
                  </>
                )}
                {closing.helperSubmittedAt && (
                  <>
                    <Separator />
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase mb-2">헬퍼 제출</div>
                      <div className="text-sm">{formatDate(closing.helperSubmittedAt)}</div>
                    </div>
                  </>
                )}
                {closing.requesterApprovedAt && (
                  <>
                    <Separator />
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase mb-2">의뢰자 승인</div>
                      <div className="text-sm text-green-600">{formatDate(closing.requesterApprovedAt)}</div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* 지원자 목록 */}
          {applications.length > 0 && (
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-5 w-5 text-indigo-500" />
                  지원자 ({applications.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {applications.map((app) => (
                    <div key={app.id} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium">{app.helperName}</div>
                          {app.helperTeamName && (
                            <div className="text-xs text-muted-foreground mt-1">
                              <Badge variant="outline" className="text-xs">{app.helperTeamName}</Badge>
                            </div>
                          )}
                        </div>
                        <StatusBadge status={app.status} size="sm" />
                      </div>
                      {app.message && (
                        <div className="text-sm bg-muted p-2 rounded mt-2">{app.message}</div>
                      )}
                      {app.expectedArrival && (
                        <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          예상 도착: {formatDate(app.expectedArrival)}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-2">
                        지원일: {formatDate(app.appliedAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 오른쪽: 정산/결제 정보 */}
        <div className="space-y-6">
          {/* 정산 정보 */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-5 w-5 text-emerald-500" />
                정산 정보
              </CardTitle>
              <CardDescription>
                {settlements.length}개의 정산 건
              </CardDescription>
            </CardHeader>
            <CardContent>
              {settlements.length > 0 ? (
                <div className="space-y-4">
                  {settlements.map((settlement) => {
                    const settlementStatus = SETTLEMENT_STATUS_CONFIG[settlement.status] || {
                      label: settlement.status,
                      color: 'bg-gray-500',
                    };

                    return (
                      <div key={settlement.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="text-sm font-medium">정산 #{settlement.id}</div>
                          <Badge className={settlementStatus.color}>
                            {settlementStatus.label}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">정산 금액</span>
                            <span className="font-medium">{formatMoney(settlement.amount)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">플랫폼 수수료</span>
                            <span className="text-red-600 font-medium">-{formatMoney(settlement.platformFee)}</span>
                          </div>
                          <Separator />
                          <div className="flex justify-between bg-green-50 p-2 rounded-md">
                            <span className="text-sm font-bold">순수익</span>
                            <span className="text-lg font-bold text-green-600">{formatMoney(settlement.netAmount)}</span>
                          </div>
                          <Separator />
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div>생성: {formatDate(settlement.createdAt)}</div>
                            {settlement.approvedAt && (
                              <div className="text-green-600">승인: {formatDate(settlement.approvedAt)}</div>
                            )}
                            {settlement.paidAt && (
                              <div className="text-blue-600">지급: {formatDate(settlement.paidAt)}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={<DollarSign className="h-8 w-8 text-muted-foreground" />}
                  title="정산 없음"
                  description="아직 정산 내역이 없습니다"
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
