// Supabase 클라이언트 초기화
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Supabase 프로젝트 설정
const supabaseUrl = 'https://jixilujgfxhjkxnccqkr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppeGlsdWpnZnhoamt4bmNjcWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyNTM0MzQsImV4cCI6MjA3MTgyOTQzNH0.oZe736JH7hcdPLcNKfjTsthDxxKAMr6pieBHF26ZGPE';

// Supabase 클라이언트 생성
export const supabase = createClient(supabaseUrl, supabaseKey);

// 데이터베이스 테이블 이름
export const TABLES = {
    TASKS: 'tasks',
    TAGS: 'tags'
};

// RLS 정책을 위한 사용자 ID 가져오기
export const getCurrentUserId = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
        console.error('사용자 인증 오류:', error);
        return null;
    }
    
    return user?.id;
};

// 익명 인증으로 사용자 생성
export const signInAnonymously = async () => {
    const { data, error } = await supabase.auth.signInAnonymously();
    
    if (error) {
        console.error('익명 인증 오류:', error);
        return null;
    }
    
    return data.user;
};

// 이메일로 로그인 (선택사항)
export const signInWithEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    
    if (error) {
        console.error('이메일 로그인 오류:', error);
        return null;
    }
    
    return data.user;
};

// 로그아웃
export const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
        console.error('로그아웃 오류:', error);
        return false;
    }
    
    return true;
};

// 인증 상태 변경 감지
export const onAuthStateChange = (callback) => {
    return supabase.auth.onAuthStateChange(callback);
}; 