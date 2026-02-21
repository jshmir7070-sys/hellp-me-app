import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ExcelTable, ColumnDef } from '@/components/common/ExcelTable';
import { StatusBadge, DateRangePicker, getDefaultDateRange } from '@/components/common';
import { Bell, Send, Plus, RefreshCw, MessageSquare, Mail, Smartphone, Download, Eye, Trash2, ImageIcon, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest, getAuthHeaders } from '@/lib/api';

interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  userName?: string;
  userEmail?: string;
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  targetRole: string;
  targetAudience?: string;
  priority: string;
  isActive: boolean;
  createdAt: string;
  expiresAt?: string;
  createdBy: number;
  creatorName?: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  isPopup?: boolean;
}

export default function NotificationsPage() {
  const [dateRange, setDateRange] = useState(getDefaultDateRange(30));
  const [activeTab, setActiveTab] = useState<'sent' | 'announcements'>('sent');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Notification | Announcement | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [sendForm, setSendForm] = useState({
    title: '',
    message: '',
    targetType: 'all' as 'all' | 'helpers' | 'requesters' | 'specific',
    notificationType: 'push' as 'push' | 'sms' | 'email',
  });

  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    targetRole: 'all',
    priority: 'normal',
    expiresAt: '',
    imageUrl: '',
    linkUrl: '',
    isPopup: false,
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  const { data: notifications = [], isLoading: notificationsLoading, refetch: refetchNotifications } = useQuery<Notification[]>({
    queryKey: ['/notifications', dateRange.from, dateRange.to],
    queryFn: async (): Promise<Notification[]> => {
      const params = new URLSearchParams();
      if (dateRange.from) params.append('from', dateRange.from);
      if (dateRange.to) params.append('to', dateRange.to);
      const res = await apiRequest(`/notifications?${params.toString()}`);
      return res as Notification[];
    },
  });

  const { data: announcements = [], isLoading: announcementsLoading, refetch: refetchAnnouncements } = useQuery<Announcement[]>({
    queryKey: ['/announcements'],
    queryFn: async (): Promise<Announcement[]> => {
      const res = await apiRequest('/announcements');
      return res as Announcement[];
    },
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async (data: typeof sendForm) => {
      return apiRequest('/notifications/send', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: '알림 발송 완료' });
      setShowSendDialog(false);
      setSendForm({ title: '', message: '', targetType: 'all', notificationType: 'push' });
      queryClient.invalidateQueries({ queryKey: ['/notifications'] });
    },
    onError: (error: Error) => {
      toast({ title: '발송 실패', description: error.message, variant: 'destructive' });
    },
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: async (data: typeof announcementForm) => {
      const adminUser = JSON.parse(localStorage.getItem('admin_user') || '{}');
      return apiRequest('/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title: data.title,
          content: data.content,
          targetAudience: data.targetRole,
          createdBy: adminUser?.id || 'admin',
          imageUrl: data.imageUrl || null,
          linkUrl: data.linkUrl || null,
          isPopup: data.isPopup,
          priority: data.priority,
          expiresAt: data.expiresAt || null,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: '공지사항 등록 완료' });
      setShowAnnouncementDialog(false);
      setAnnouncementForm({ title: '', content: '', targetRole: 'all', priority: 'normal', expiresAt: '', imageUrl: '', linkUrl: '', isPopup: false });
      queryClient.invalidateQueries({ queryKey: ['/announcements'] });
    },
    onError: (error: Error) => {
      toast({ title: '등록 실패', description: error.message, variant: 'destructive' });
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const authHeaders = getAuthHeaders();
      const response = await fetch('/api/admin/announcements/upload-image', {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });

      if (!response.ok) {
        throw new Error('이미지 업로드에 실패했습니다');
      }

      const result = await response.json();
      setAnnouncementForm(prev => ({ ...prev, imageUrl: result.url }));
      toast({ title: '이미지 업로드 완료' });
    } catch (err: any) {
      toast({ title: '이미지 업로드 실패', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingImage(false);
    }
  };

  const deleteAnnouncementMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/announcements/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast({ title: '공지사항 삭제 완료' });
      queryClient.invalidateQueries({ queryKey: ['/announcements'] });
    },
    onError: (error: Error) => {
      toast({ title: '삭제 실패', description: error.message, variant: 'destructive' });
    },
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'push':
        return <Smartphone className="h-4 w-4" />;
      case 'sms':
        return <MessageSquare className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getTargetLabel = (targetType: string) => {
    switch (targetType) {
      case 'all':
        return '전체';
      case 'helper':
      case 'helpers':
        return '헬퍼';
      case 'requester':
      case 'requesters':
        return '요청자';
      case 'admin':
        return '관리자';
      default:
        return targetType;
    }
  };

  const handleRefresh = async () => {
    if (activeTab === 'sent') {
      await refetchNotifications();
    } else {
      await refetchAnnouncements();
    }
    toast({ title: '새로고침 완료' });
  };

  const handleDownloadExcel = () => {
    if (activeTab === 'sent') {
      const headers = ['ID', '제목', '유형', '대상 사용자', '생성일시', '읽음 여부'];
      const rows = filteredNotifications.map((row) => [
        `NTF-${row.id}`,
        row.title || '',
        row.type?.toUpperCase() || '',
        row.userName || row.userEmail || `사용자#${row.userId}`,
        row.createdAt ? new Date(row.createdAt).toLocaleString('ko-KR') : '',
        row.isRead ? '읽음' : '안읽음',
      ]);
      const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `알림목록_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = ['ID', '제목', '대상', '우선순위', '활성', '생성일', '만료일'];
      const rows = filteredAnnouncements.map((row) => [
        `ANN-${row.id}`,
        row.title || '',
        getTargetLabel(row.targetRole),
        row.priority,
        row.isActive ? '활성' : '비활성',
        row.createdAt ? new Date(row.createdAt).toLocaleString('ko-KR') : '',
        row.expiresAt ? new Date(row.expiresAt).toLocaleString('ko-KR') : '',
      ]);
      const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `공지사항목록_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    toast({ title: '다운로드 완료' });
  };

  const filteredNotifications = notifications.filter((n) => {
    if (!searchQuery) return true;
    return n.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           n.content?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredAnnouncements = announcements.filter((a) => {
    if (!searchQuery) return true;
    return a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           a.content?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const notificationColumns: ColumnDef<Notification>[] = [
    {
      key: 'id',
      header: 'ID',
      width: 100,
      render: (value) => <span className="font-mono text-sm">NTF-{value}</span>,
    },
    {
      key: 'title',
      header: '제목',
      width: 200,
      render: (value) => <span className="font-medium">{value}</span>,
    },
    {
      key: 'type',
      header: '유형',
      width: 100,
      render: (value) => (
        <div className="flex items-center gap-2">
          {getTypeIcon(value)}
          {value?.toUpperCase() || '-'}
        </div>
      ),
    },
    {
      key: 'userName',
      header: '대상 사용자',
      width: 150,
      render: (value: string | undefined, row: Notification) => value || row.userEmail || `사용자#${row.userId}`,
    },
    {
      key: 'createdAt',
      header: '발송일시',
      width: 160,
      render: (value) => (
        <span className="text-sm text-muted-foreground">
          {value ? new Date(value).toLocaleString('ko-KR') : '-'}
        </span>
      ),
    },
    {
      key: 'isRead',
      header: '읽음',
      width: 80,
      align: 'center',
      render: (value) => (
        <StatusBadge status={value ? 'COMPLETED' : 'PENDING'} />
      ),
    },
    {
      key: 'actions',
      header: '',
      width: 60,
      render: (_: unknown, row: Notification) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setSelectedItem(row); setShowDetailDialog(true); }}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const announcementColumns: ColumnDef<Announcement>[] = [
    {
      key: 'id',
      header: 'ID',
      width: 80,
      render: (value) => <span className="font-mono text-sm">ANN-{value}</span>,
    },
    {
      key: 'title',
      header: '제목',
      width: 200,
      render: (value, row: Announcement) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{value}</span>
          {row.imageUrl && <ImageIcon className="h-3 w-3 text-blue-500" />}
        </div>
      ),
    },
    {
      key: 'targetAudience',
      header: '대상',
      width: 80,
      render: (value, row: Announcement) => getTargetLabel(value || row.targetRole),
    },
    {
      key: 'priority',
      header: '우선순위',
      width: 80,
      render: (value) => (
        <StatusBadge status={value === 'urgent' ? 'CANCELLED' : value === 'high' ? 'PENDING' : 'COMPLETED'} />
      ),
    },
    {
      key: 'isPopup',
      header: '팝업',
      width: 70,
      align: 'center',
      render: (value) => (
        <span className={cn("text-xs font-medium", value ? "text-blue-600" : "text-muted-foreground")}>
          {value ? '팝업' : '-'}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: '상태',
      width: 70,
      align: 'center',
      render: (value) => (
        <StatusBadge status={value ? 'COMPLETED' : 'CANCELLED'} />
      ),
    },
    {
      key: 'createdAt',
      header: '등록일',
      width: 140,
      render: (value) => (
        <span className="text-sm text-muted-foreground">
          {value ? new Date(value).toLocaleDateString('ko-KR') : '-'}
        </span>
      ),
    },
    {
      key: 'expiresAt',
      header: '만료일',
      width: 140,
      render: (value) => (
        <span className="text-sm text-muted-foreground">
          {value ? new Date(value).toLocaleDateString('ko-KR') : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: 100,
      render: (_: unknown, row: Announcement) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSelectedItem(row); setShowDetailDialog(true); }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm('이 공지사항을 삭제하시겠습니까?')) {
                deleteAnnouncementMutation.mutate(row.id);
              }
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const todayCount = notifications.filter(n => {
    const today = new Date();
    const created = new Date(n.createdAt);
    return created.toDateString() === today.toDateString();
  }).length;

  const pushCount = notifications.filter(n => n.type === 'push').length;
  const smsCount = notifications.filter(n => n.type === 'sms').length;
  const emailCount = notifications.filter(n => n.type === 'email').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">알림/공지</h1>
          <p className="text-muted-foreground">푸시 알림, SMS, 이메일 발송 및 공지사항 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadExcel}>
            <Download className="h-4 w-4 mr-2" />
            엑셀 다운로드
          </Button>
          {activeTab === 'sent' ? (
            <Button size="sm" onClick={() => setShowSendDialog(true)}>
              <Send className="h-4 w-4 mr-2" />
              알림 발송
            </Button>
          ) : (
            <Button size="sm" onClick={() => setShowAnnouncementDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              공지 등록
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오늘 발송</CardTitle>
            <Send className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayCount}</div>
            <p className="text-xs text-muted-foreground">발송 완료</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">푸시 알림</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pushCount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">전체 발송</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SMS</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{smsCount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">전체 발송</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">이메일</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{emailCount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">전체 발송</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('sent')}
          className={cn(
            'px-4 py-3 text-sm font-medium transition-colors relative',
            activeTab === 'sent'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          발송 내역
          {activeTab === 'sent' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('announcements')}
          className={cn(
            'px-4 py-3 text-sm font-medium transition-colors relative',
            activeTab === 'announcements'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          공지사항
          {activeTab === 'announcements' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>
              {activeTab === 'sent' ? '발송 내역' : '공지사항'}
              {selectedIds.size > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({selectedIds.size}개 선택됨)
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-4">
              {activeTab === 'sent' && <DateRangePicker value={dateRange} onChange={setDateRange} />}
              <Input
                placeholder="검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === 'sent' && (
            <ExcelTable
              data={filteredNotifications}
              columns={notificationColumns}
              loading={notificationsLoading}
              emptyMessage="발송된 알림이 없습니다."
              getRowId={(row) => row.id}
              storageKey="notifications-table"
              selectable
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              maxHeight="calc(100vh - 450px)"
            />
          )}

          {activeTab === 'announcements' && (
            <ExcelTable
              data={filteredAnnouncements}
              columns={announcementColumns}
              loading={announcementsLoading}
              emptyMessage="등록된 공지사항이 없습니다."
              getRowId={(row) => row.id}
              storageKey="announcements-table"
              selectable
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              maxHeight="calc(100vh - 450px)"
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>알림 발송</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>발송 유형</Label>
              <Select
                value={sendForm.notificationType}
                onValueChange={(v) => setSendForm(prev => ({ ...prev, notificationType: v as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="push">푸시 알림</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">이메일</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>대상</Label>
              <Select
                value={sendForm.targetType}
                onValueChange={(v) => setSendForm(prev => ({ ...prev, targetType: v as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="helpers">헬퍼</SelectItem>
                  <SelectItem value="requesters">요청자</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>제목</Label>
              <Input
                value={sendForm.title}
                onChange={(e) => setSendForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="알림 제목"
              />
            </div>
            <div className="space-y-2">
              <Label>내용</Label>
              <Textarea
                value={sendForm.message}
                onChange={(e) => setSendForm(prev => ({ ...prev, message: e.target.value }))}
                placeholder="알림 내용을 입력하세요"
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSendDialog(false)}>취소</Button>
              <Button
                onClick={() => sendNotificationMutation.mutate(sendForm)}
                disabled={!sendForm.title || !sendForm.message || sendNotificationMutation.isPending}
              >
                {sendNotificationMutation.isPending ? '발송 중...' : '발송'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAnnouncementDialog} onOpenChange={setShowAnnouncementDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>공지사항 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>제목</Label>
              <Input
                value={announcementForm.title}
                onChange={(e) => setAnnouncementForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="공지 제목"
              />
            </div>
            <div className="space-y-2">
              <Label>내용</Label>
              <Textarea
                value={announcementForm.content}
                onChange={(e) => setAnnouncementForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="공지 내용을 입력하세요"
                rows={6}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>대상</Label>
                <Select
                  value={announcementForm.targetRole}
                  onValueChange={(v) => setAnnouncementForm(prev => ({ ...prev, targetRole: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="helper">헬퍼</SelectItem>
                    <SelectItem value="requester">요청자</SelectItem>
                    <SelectItem value="admin">관리자</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>우선순위</Label>
                <Select
                  value={announcementForm.priority}
                  onValueChange={(v) => setAnnouncementForm(prev => ({ ...prev, priority: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">일반</SelectItem>
                    <SelectItem value="high">높음</SelectItem>
                    <SelectItem value="urgent">긴급</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>만료일 (선택)</Label>
              <Input
                type="datetime-local"
                value={announcementForm.expiresAt}
                onChange={(e) => setAnnouncementForm(prev => ({ ...prev, expiresAt: e.target.value }))}
              />
            </div>

            {/* 팝업/광고 설정 */}
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                팝업/광고 설정
              </h4>

              {/* 이미지 업로드 */}
              <div className="space-y-2">
                <Label>팝업 이미지 (선택)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="flex-1"
                  />
                  {uploadingImage && <span className="text-sm text-muted-foreground">업로드 중...</span>}
                </div>
                {announcementForm.imageUrl && (
                  <div className="relative mt-2">
                    <img
                      src={announcementForm.imageUrl}
                      alt="미리보기"
                      className="w-full max-h-48 object-cover rounded-md border"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => setAnnouncementForm(prev => ({ ...prev, imageUrl: '' }))}
                    >
                      삭제
                    </Button>
                  </div>
                )}
              </div>

              {/* 링크 URL */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <LinkIcon className="h-3 w-3" />
                  링크 URL (선택)
                </Label>
                <Input
                  value={announcementForm.linkUrl}
                  onChange={(e) => setAnnouncementForm(prev => ({ ...prev, linkUrl: e.target.value }))}
                  placeholder="https://... 또는 앱 내 화면명"
                />
                <p className="text-xs text-muted-foreground">이미지 탭 시 이동할 링크입니다</p>
              </div>

              {/* 팝업 표시 여부 */}
              <div className="flex items-center gap-3">
                <Checkbox
                  id="isPopup"
                  checked={announcementForm.isPopup}
                  onCheckedChange={(checked) => setAnnouncementForm(prev => ({ ...prev, isPopup: !!checked }))}
                />
                <Label htmlFor="isPopup" className="text-sm cursor-pointer">
                  로그인 시 팝업으로 표시
                </Label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAnnouncementDialog(false)}>취소</Button>
              <Button
                onClick={() => createAnnouncementMutation.mutate(announcementForm)}
                disabled={!announcementForm.title || !announcementForm.content || createAnnouncementMutation.isPending || uploadingImage}
              >
                {createAnnouncementMutation.isPending ? '등록 중...' : '등록'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>상세 정보</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">제목</Label>
                <p className="font-medium">{selectedItem.title}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">내용</Label>
                <p className="whitespace-pre-wrap">{selectedItem.content}</p>
              </div>
              {'type' in selectedItem && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">유형</Label>
                    <p>{selectedItem.type?.toUpperCase()}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">읽음 여부</Label>
                    <p>{selectedItem.isRead ? '읽음' : '안읽음'}</p>
                  </div>
                </div>
              )}
              {'targetRole' in selectedItem && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">대상</Label>
                      <p>{getTargetLabel((selectedItem as Announcement).targetAudience || selectedItem.targetRole)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">우선순위</Label>
                      <p>{selectedItem.priority}</p>
                    </div>
                  </div>
                  {(selectedItem as Announcement).isPopup && (
                    <div>
                      <Label className="text-muted-foreground">팝업 표시</Label>
                      <p className="text-blue-600 font-medium">팝업 활성화됨</p>
                    </div>
                  )}
                  {(selectedItem as Announcement).imageUrl && (
                    <div>
                      <Label className="text-muted-foreground">팝업 이미지</Label>
                      <img
                        src={(selectedItem as Announcement).imageUrl!}
                        alt="팝업 이미지"
                        className="mt-1 w-full max-h-48 object-cover rounded-md border"
                      />
                    </div>
                  )}
                  {(selectedItem as Announcement).linkUrl && (
                    <div>
                      <Label className="text-muted-foreground">링크 URL</Label>
                      <p className="text-sm text-blue-600 break-all">{(selectedItem as Announcement).linkUrl}</p>
                    </div>
                  )}
                </>
              )}
              <div>
                <Label className="text-muted-foreground">생성일</Label>
                <p>{new Date(selectedItem.createdAt).toLocaleString('ko-KR')}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
