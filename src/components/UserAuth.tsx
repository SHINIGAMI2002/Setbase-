/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthService, UserSession } from '../utils/db';
import { ShieldAlert, User, Lock, Mail, HelpCircle, KeyRound, CheckCircle, LogOut, ArrowRight, Eye, EyeOff } from 'lucide-react';

interface UserAuthProps {
  onSessionChange: (session: UserSession | null) => void;
  currentSession: UserSession | null;
}

export default function UserAuth({ onSessionChange, currentSession }: UserAuthProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [showPassword, setShowPassword] = useState(false);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [question, setQuestion] = useState('ชื่อโรงเรียนประถมแห่งแรกของคุณคืออะไร?');
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const switchMode = (newMode: 'login' | 'signup' | 'reset') => {
    setMode(newMode);
    clearMessages();
    setPassword('');
    setNewPassword('');
    setAnswer('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);

    try {
      const session = await AuthService.login(email, password);
      onSessionChange(session);
      setSuccess('เข้าสู่ระบบสำเร็จแล้ว!');
    } catch (err: any) {
      setError(err.message || 'รหัสผ่านหรืออีเมลไม่ถูกต้อง');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);

    try {
      if (password.length < 6) {
        throw new Error('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษรเพื่อความปลอดภัย');
      }
      const session = await AuthService.signup(email, password, question, answer);
      onSessionChange(session);
      setSuccess('สร้างบัญชีและเข้าสู่ระบบสำเร็จแล้ว!');
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);

    try {
      if (newPassword.length < 6) {
        throw new Error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      }
      await AuthService.resetPassword(email, answer, newPassword);
      setSuccess('รีเซ็ตรหัสผ่านใหม่สำเร็จแล้ว! กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่');
      setMode('login');
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'ข้อมูลความปลอดภัยไม่ถูกต้อง');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    AuthService.logout();
    onSessionChange(null);
    clearMessages();
    setEmail('');
    setPassword('');
  };

  if (currentSession) {
    return (
      <div id="auth-panel-active" className="bg-[#16171D] border border-emerald-500/20 rounded-2xl p-6 shadow-lg flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <User className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <h3 className="text-sm font-extrabold text-white">ระบบเก็บรักษาข้อมูลพิกัดปลอดภัยระดับสูง (Secure-Drive Enabled)</h3>
            </div>
            <p className="text-xs text-slate-350 mt-1 font-mono">
              ผู้ใช้งานระบุระบบ: <span className="text-emerald-400 font-bold">{currentSession.email}</span>
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          type="button"
          className="inline-flex items-center gap-1.5 px-4 h-11 text-xs font-black text-rose-450 text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/15 hover:border-rose-500/20 rounded-xl cursor-pointer transition-all active:scale-95 uppercase tracking-wider"
        >
          <LogOut className="w-4 h-4" />
          LOGOUT
        </button>
      </div>
    );
  }

  return (
    <div id="survey-auth-panel" className="bg-[#16171D] border border-white/10 rounded-2xl shadow-xl p-6.5 max-w-xl mx-auto">
      {/* Title block */}
      <div className="border-b border-white/5 pb-4 mb-5 text-center sm:text-left">
        <div className="flex justify-center sm:justify-start items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <KeyRound className="w-4.5 h-4.5" />
          </div>
          <h2 className="text-md font-extrabold text-white font-sans uppercase tracking-wide">
            ระบบเข้าใช้งานและซิงค์ข้อมูล (Survey Secure Core)
          </h2>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          กรุณาเข้าสู่ระบบเพื่อสำรองพิกัดสถานี ย้ายเครื่องทำงาน หรือใช้ระบบประมวลผลกึ่งอัตโนมัติ
        </p>
      </div>

      {/* Mode Switches */}
      <div className="flex bg-black/40 border border-white/10 p-1 rounded-xl mb-5 text-xs font-bold">
        <button
          onClick={() => switchMode('login')}
          type="button"
          className={`flex-1 py-2.5 text-center rounded-lg cursor-pointer transition-colors ${
            mode === 'login' ? 'bg-[#1C1D24] text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          เข้าสู่ระบบ (Sign In)
        </button>
        <button
          onClick={() => switchMode('signup')}
          type="button"
          className={`flex-1 py-2.5 text-center rounded-lg cursor-pointer transition-colors ${
            mode === 'signup' ? 'bg-[#1C1D24] text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          สมัครสมาชิกใหม่ (Sign Up)
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2.5 text-rose-500 bg-rose-500/5 border border-rose-500/15 rounded-xl p-3.5 text-xs font-semibold">
          <ShieldAlert className="w-4.5 h-4.5 shrink-0 mt-0.5 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 flex items-start gap-2.5 text-emerald-400 bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3.5 text-xs font-semibold">
          <CheckCircle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-emerald-400" />
          <span>{success}</span>
        </div>
      )}

      {/* Interactive Forms switcher */}
      {mode === 'login' && (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2" htmlFor="signin-email">
              อีเมลผู้ใช้งาน (Registered Email)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                id="signin-email"
                type="email"
                required
                placeholder="ชื่ออีเมลของคุณ@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 pl-10 pr-4 bg-black/50 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider" htmlFor="signin-password">
                รหัสผ่านเข้ารหัสคีย์ (Password)
              </label>
              <button
                type="button"
                onClick={() => switchMode('reset')}
                className="text-[10.5px] font-bold text-amber-500 hover:text-amber-400 cursor-pointer uppercase tracking-wider"
              >
                ลืมรหัสผ่าน? (Reset)
              </button>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                id="signin-password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="โปรดกรอกรหัสผ่านเข้ารหัส"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 pl-10 pr-10 bg-black/50 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-white cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:shadow-lg active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            {loading ? 'กำลังประมวลผลความปลอดภัย...' : 'ลงชื่อเข้าสู่ระบบ (AUTHENTICATE)'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}

      {mode === 'signup' && (
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2" htmlFor="signup-email">
              กำหนดอีเมลระบุตัวตน (Identity Email)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                id="signup-email"
                type="email"
                required
                placeholder="ชื่ออีเมลของคุณ@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 pl-10 pr-4 bg-black/50 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500"
              />
            </div>
            <span className="text-[9.5px] text-slate-550 text-slate-500 mt-1 block">อีเมลนี้จะใช้เป็นคีย์หลักในการผูกข้อมูลพิกัด (UTM)</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2" htmlFor="signup-password">
              กำหนดรหัสผ่าน (Password - มีอย่างน้อย 6 ตัวอักษร)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="โปรดกรอกรหัสผ่านเพื่อเข้ารหัสความปลอดภัย"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 pl-10 pr-10 bg-black/50 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-white cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>

          {/* Secure local recovery question */}
          <div className="bg-black/25 border border-white/5 p-4 rounded-xl space-y-3.5">
            <span className="block text-[10.5px] font-bold text-amber-550 text-amber-400 flex items-center gap-1 justify-center sm:justify-start">
              <HelpCircle className="w-4 h-4" /> คำถามเพื่อกู้คืนรหัสผ่านด้วยตนเอง (Secure Self-Reset)
            </span>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1.5" htmlFor="signup-question">
                เลือกหรือพิมพ์ข้อคำถามความปลอดภัย
              </label>
              <select
                id="signup-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="w-full h-10 px-3 bg-[#1C1D24] border border-white/10 rounded-lg text-xs font-medium text-white focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="ชื่อโรงเรียนประถมแห่งแรกของคุณคืออะไร?">ชื่อโรงเรียนประถมแห่งแรกของคุณคืออะไร?</option>
                <option value="สัตว์เลี้ยงตัวแรกของคุณชื่ออะไร?">สัตว์เลี้ยงตัวแรกของคุณชื่ออะไร?</option>
                <option value="จังหวัดบ้านเกิดของปู่หรือย่าของคุณคืออะไร?">จังหวัดบ้านเกิดของปู่หรือย่าของคุณคืออะไร?</option>
                <option value="รถยนต์คันแรกของคุณยี่ห้ออะไร?">รถยนต์คันแรกของคุณยี่ห้ออะไร?</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1.5" htmlFor="signup-answer">
                ระบุคำตอบความปลอดภัย (จะถูกเก็บแบบ Hashed ทางฝั่งไคลเอนต์)
              </label>
              <input
                id="signup-answer"
                type="text"
                required
                placeholder="กรอกคำตอบอ้างอิงของคุณที่จำได้ง่าย"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="w-full h-10 px-3 bg-[#1C1D24] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:shadow-lg active:scale-98 transition-all cursor-pointer flex items-center justify-center"
          >
            {loading ? 'กำลังคำนวณและเข้ารหัสฐานพิกัด...' : 'ลงทะเบียนบัญชีใหม่ (REGISTER ACCOUNT)'}
          </button>
        </form>
      )}

      {mode === 'reset' && (
        <form onSubmit={handleReset} className="space-y-4">
          <div className="bg-amber-500/5 border border-amber-500/15 p-3.5 rounded-xl text-xs text-amber-500/90 leading-relaxed mb-4">
            ป้อนอีเมลที่คุณระบุไว้ จากนั้นตอบคำถามเพื่อความปลอดภัยที่คุณตั้งขึ้นมา ระบบจะทำการยอมรับและเข้ารหัส Hashed รหัสผ่านใหม่ให้กับอุปกรณ์ของคุณทันที
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2" htmlFor="reset-email">
              ระบุอีเมลผู้ใช้งาน (Registered Email)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                id="reset-email"
                type="email"
                required
                placeholder="ชื่ออีเมลของคุณ@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 pl-10 pr-4 bg-black/50 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5" htmlFor="reset-answer">
              คำตอบของคำถามความปลอดภัย (Security Answer)
            </label>
            <input
              id="reset-answer"
              type="text"
              required
              placeholder="ป้อนคำตอบที่พิมพ์ไว้ตอนสมัครสมาชิก"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="w-full h-11 px-4 bg-black/50 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 animate-none placeholder:text-slate-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1.5" htmlFor="reset-new-password">
              กำหนดรหัสผ่านใหม่ (New Password - อย่างน้อย 6 ตัวอักษร)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                id="reset-new-password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="โปรดกรอกพาสเวิร์ดใหม่ที่จะเปลี่ยน"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full h-11 pl-10 pr-10 bg-black/50 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-white cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              onClick={() => switchMode('login')}
              type="button"
              className="px-4 py-3 bg-[#1C1D24] text-slate-350 hover:text-white border border-white/10 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              ย้อนกลับ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:shadow-lg transition-all cursor-pointer text-center"
            >
              {loading ? 'กำลังเปลี่ยนรหัสพิกัดความปลอดภัย...' : 'ยืนยันเพื่อเปลี่ยนรหัสผ่าน'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
