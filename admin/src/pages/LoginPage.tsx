import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/toaster';
import { apiRequest } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface LoginResponse {
  requireSmsVerification?: boolean;
  tempToken?: string;
  phoneNumber?: string;
  token?: string;
  user?: any;
  passwordExpired?: boolean;
  passwordExpiresSoon?: boolean;
  daysUntilExpiry?: number;
}

export default function LoginPage() {
  const { loginWithToken } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);
  
  const [showSmsVerification, setShowSmsVerification] = useState(false);
  const [smsCode, setSmsCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [smsLoading, setSmsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeToken, setPasswordChangeToken] = useState('');
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('admin_saved_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberEmail(true);
    }
  }, []);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (rememberEmail) {
        localStorage.setItem('admin_saved_email', email);
      } else {
        localStorage.removeItem('admin_saved_email');
      }

      const response = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (response.passwordExpired) {
        setPasswordChangeToken(response.tempToken || '');
        setShowPasswordChange(true);
        toast({
          title: '비밀번호 변경 필요',
          description: '비밀번호가 만료되었습니다. 새 비밀번호를 설정해주세요.',
          variant: 'destructive',
        });
        return;
      }

      if (response.requireSmsVerification) {
        setTempToken(response.tempToken || '');
        setMaskedPhone(response.phoneNumber || '');
        setShowSmsVerification(true);
        setResendCooldown(60);
        toast({
          title: 'SMS 인증',
          description: '휴대폰으로 인증번호가 발송되었습니다.',
        });
        return;
      }

      if (response.passwordExpiresSoon && response.daysUntilExpiry !== undefined) {
        toast({
          title: '비밀번호 만료 예정',
          description: `비밀번호가 ${response.daysUntilExpiry}일 후 만료됩니다. 보안을 위해 변경해주세요.`,
          variant: 'default',
        });
      }

      if (response.token && response.user) {
        loginWithToken(response.token, response.user);
      }
    } catch (error) {
      toast({
        title: '로그인 실패',
        description: error instanceof Error ? error.message : '이메일 또는 비밀번호를 확인해주세요.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSmsVerification = async () => {
    if (smsCode.length !== 6) {
      toast({
        title: '인증 실패',
        description: '6자리 인증번호를 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setSmsLoading(true);
    try {
      const response = await apiRequest<{ token: string; user: any }>('/auth/verify-sms', {
        method: 'POST',
        body: JSON.stringify({ tempToken, code: smsCode }),
      });

      loginWithToken(response.token, response.user);
      setShowSmsVerification(false);
    } catch (error) {
      toast({
        title: '인증 실패',
        description: error instanceof Error ? error.message : '인증번호가 올바르지 않습니다.',
        variant: 'destructive',
      });
    } finally {
      setSmsLoading(false);
    }
  };

  const handleResendSms = async () => {
    if (resendCooldown > 0) return;
    
    try {
      await apiRequest('/auth/resend-sms', {
        method: 'POST',
        body: JSON.stringify({ tempToken }),
      });
      setResendCooldown(60);
      toast({
        title: '재발송 완료',
        description: '인증번호가 다시 발송되었습니다.',
      });
    } catch (error) {
      toast({
        title: '발송 실패',
        description: error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.',
        variant: 'destructive',
      });
    }
  };

  const handlePasswordReset = async () => {
    if (!resetEmail) {
      toast({
        title: '입력 필요',
        description: '이메일을 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setResetLoading(true);
    try {
      await apiRequest('/auth/request-password-reset', {
        method: 'POST',
        body: JSON.stringify({ email: resetEmail }),
      });
      toast({
        title: '이메일 발송',
        description: '비밀번호 초기화 안내가 이메일로 발송되었습니다.',
      });
      setShowPasswordReset(false);
      setResetEmail('');
    } catch (error) {
      toast({
        title: '요청 실패',
        description: error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.',
        variant: 'destructive',
      });
    } finally {
      setResetLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 8) {
      toast({
        title: '비밀번호 오류',
        description: '비밀번호는 8자 이상이어야 합니다.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: '비밀번호 불일치',
        description: '새 비밀번호가 일치하지 않습니다.',
        variant: 'destructive',
      });
      return;
    }

    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

    if (!(hasUpperCase && hasLowerCase && hasNumber && hasSpecial)) {
      toast({
        title: '비밀번호 복잡도 부족',
        description: '대문자, 소문자, 숫자, 특수문자를 모두 포함해야 합니다.',
        variant: 'destructive',
      });
      return;
    }

    setPasswordChangeLoading(true);
    try {
      const response = await apiRequest<{ token: string; user: any }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ 
          tempToken: passwordChangeToken, 
          newPassword 
        }),
      });

      toast({
        title: '비밀번호 변경 완료',
        description: '새 비밀번호로 로그인되었습니다.',
      });

      loginWithToken(response.token, response.user);
      setShowPasswordChange(false);
    } catch (error) {
      toast({
        title: '변경 실패',
        description: error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.',
        variant: 'destructive',
      });
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Hellp Me Admin</CardTitle>
          <CardDescription className="text-center">
            관리자 계정으로 로그인하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@hellpme.kr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="remember" 
                  checked={rememberEmail}
                  onCheckedChange={(checked) => setRememberEmail(checked === true)}
                />
                <Label htmlFor="remember" className="text-sm cursor-pointer">
                  아이디 저장
                </Label>
              </div>
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() => {
                  setResetEmail(email);
                  setShowPasswordReset(true);
                }}
              >
                비밀번호 초기화
              </button>
            </div>
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? '로그인 중...' : '로그인'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={showSmsVerification} onOpenChange={setShowSmsVerification}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>휴대폰 인증</DialogTitle>
            <DialogDescription>
              {maskedPhone}로 발송된 6자리 인증번호를 입력해주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="인증번호 6자리"
              value={smsCode}
              onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              className="text-center text-2xl tracking-widest"
            />
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={handleResendSms}
                disabled={resendCooldown > 0}
              >
                {resendCooldown > 0 ? `재발송 (${resendCooldown}초)` : '인증번호 재발송'}
              </Button>
              <Button 
                className="flex-1"
                onClick={handleSmsVerification}
                disabled={smsLoading || smsCode.length !== 6}
              >
                {smsLoading ? '확인 중...' : '확인'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPasswordReset} onOpenChange={setShowPasswordReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>비밀번호 초기화</DialogTitle>
            <DialogDescription>
              가입한 이메일 주소를 입력하면 비밀번호 초기화 안내가 발송됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="email"
              placeholder="이메일 주소"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
            />
            <Button 
              className="w-full"
              onClick={handlePasswordReset}
              disabled={resetLoading}
            >
              {resetLoading ? '요청 중...' : '초기화 요청'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPasswordChange} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>비밀번호 변경 필요</DialogTitle>
            <DialogDescription>
              비밀번호가 만료되었습니다. 보안을 위해 새 비밀번호를 설정해주세요.
              <br />
              <span className="text-xs text-muted-foreground">
                (8자 이상, 대문자/소문자/숫자/특수문자 포함)
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="새 비밀번호"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Input
              type="password"
              placeholder="새 비밀번호 확인"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Button 
              className="w-full"
              onClick={handlePasswordChange}
              disabled={passwordChangeLoading}
            >
              {passwordChangeLoading ? '변경 중...' : '비밀번호 변경'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
