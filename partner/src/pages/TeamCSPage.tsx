import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { MessageSquare, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';

interface CSInquiry {
  id: number;
  title: string;
  content: string;
  category: string;
  status: string;
  priority: string;
  orderId?: number;
  response?: string;
  respondedAt?: string;
  adminNote?: string;
  createdAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  order: '오더', payment: '결제', settlement: '정산', member: '팀원', other: '기타',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '대기', color: 'bg-yellow-100 text-yellow-800' },
  in_progress: { label: '처리중', color: 'bg-blue-100 text-blue-800' },
  resolved: { label: '해결', color: 'bg-green-100 text-green-800' },
  closed: { label: '종료', color: 'bg-gray-100 text-gray-800' },
};

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: '낮음', color: 'text-gray-500' },
  normal: { label: '보통', color: 'text-blue-500' },
  high: { label: '높음', color: 'text-orange-500' },
  urgent: { label: '긴급', color: 'text-red-500' },
};

export default function TeamCSPage() {
  const [inquiries, setInquiries] = useState<CSInquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('other');
  const [formPriority, setFormPriority] = useState('normal');
  const [formOrderId, setFormOrderId] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadInquiries();
  }, [statusFilter]);

  const loadInquiries = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('limit', '50');
      const result = await apiRequest<{ inquiries: CSInquiry[] }>(`/cs?${params.toString()}`);
      setInquiries(result.inquiries);
    } catch (err) {
      console.error('Failed to load CS:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formTitle.trim() || !formContent.trim()) {
      alert('제목과 내용을 입력해주세요');
      return;
    }
    setCreating(true);
    try {
      await apiRequest('/cs', {
        method: 'POST',
        body: JSON.stringify({
          title: formTitle,
          content: formContent,
          category: formCategory,
          priority: formPriority,
          orderId: formOrderId || undefined,
        }),
      });
      setShowForm(false);
      setFormTitle(''); setFormContent(''); setFormCategory('other'); setFormPriority('normal'); setFormOrderId('');
      loadInquiries();
    } catch (err: any) {
      alert(err.message || '문의 생성에 실패했습니다');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">팀 CS</h1>
          <p className="text-sm text-muted-foreground mt-1">팀 관련 문의 및 요청</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? '닫기' : '새 문의'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-card border rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold mb-3">새 CS 문의</h3>
          <div className="grid gap-3">
            <input
              placeholder="제목"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm bg-background"
            />
            <div className="grid grid-cols-3 gap-3">
              <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm bg-background">
                <option value="order">오더</option>
                <option value="payment">결제</option>
                <option value="settlement">정산</option>
                <option value="member">팀원</option>
                <option value="other">기타</option>
              </select>
              <select value={formPriority} onChange={(e) => setFormPriority(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm bg-background">
                <option value="low">낮음</option>
                <option value="normal">보통</option>
                <option value="high">높음</option>
                <option value="urgent">긴급</option>
              </select>
              <input
                placeholder="오더번호 (선택)"
                value={formOrderId}
                onChange={(e) => setFormOrderId(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm bg-background"
              />
            </div>
            <textarea
              placeholder="문의 내용을 입력하세요"
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border rounded-md text-sm bg-background resize-none"
            />
            <button
              onClick={handleCreate}
              disabled={creating}
              className="self-end px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? '등록 중...' : '등록'}
            </button>
          </div>
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[{ value: '', label: '전체' }, { value: 'pending', label: '대기' }, { value: 'in_progress', label: '처리중' }, { value: 'resolved', label: '해결' }, { value: 'closed', label: '종료' }].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              statusFilter === opt.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Inquiries list */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : inquiries.length === 0 ? (
          <div className="bg-card border rounded-lg p-12 text-center text-muted-foreground text-sm">
            문의 내역이 없습니다
          </div>
        ) : (
          inquiries.map((inq) => {
            const statusInfo = STATUS_LABELS[inq.status] || STATUS_LABELS.pending;
            const priorityInfo = PRIORITY_LABELS[inq.priority] || PRIORITY_LABELS.normal;
            const isExpanded = expandedId === inq.id;
            return (
              <div key={inq.id} className="bg-card border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : inq.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{inq.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[inq.category] || inq.category}</span>
                        <span className={`text-xs font-medium ${priorityInfo.color}`}>{priorityInfo.label}</span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(inq.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 py-3 border-t bg-muted/10">
                    <p className="text-sm whitespace-pre-wrap">{inq.content}</p>
                    {inq.response && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-md">
                        <p className="text-xs font-semibold text-blue-800 mb-1">본사 답변</p>
                        <p className="text-sm text-blue-900">{inq.response}</p>
                        {inq.respondedAt && (
                          <p className="text-xs text-blue-600 mt-1">{formatDateTime(inq.respondedAt)}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
