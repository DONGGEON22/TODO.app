# 레오의 To-Do List 웹앱

Supabase를 백엔드로 사용하는 미니멀하고 직관적인 To-Do List 단일 페이지 웹앱입니다.

## 🎨 디자인 특징

- **토스 스타일**: 미니멀리즘, 넉넉한 여백, 명확한 타이포그래피
- **반응형 디자인**: 모바일과 데스크톱 모두 최적화
- **부드러운 애니메이션**: CSS 트랜지션과 키프레임 애니메이션
- **다크 모드 지원**: 시스템 설정에 따른 자동 테마 전환
- **접근성**: 키보드 네비게이션, 스크린 리더 지원

## 🚀 기술 스택

- **프론트엔드**: HTML5, Tailwind CSS, Vanilla JavaScript (ES6+)
- **백엔드**: Supabase
- **데이터베이스**: PostgreSQL (Supabase)
- **실시간 동기화**: Supabase Realtime
- **인증**: Supabase Auth (익명 인증)

## 📋 기능

- ✅ 할 일 추가/삭제/완료 체크
- 🚨 **우선순위 시스템**: 높음(빨간색)/보통(노란색)/낮음(흰색) 3단계
- 🏷️ **업무 태그 시스템**: 할 일별 태그 지정 및 관리
- 📝 **상세 정보 시스템**: 할 일별 상세 설명, 마감일, 예상 소요시간, 메모 등
- 🔄 실시간 동기화
- 🏷️ 필터링 (전체/진행중/완료 + 우선순위별 + 태그별)
- 📊 통계 표시
- ⌨️ 키보드 단축키 지원
- 🔒 사용자별 데이터 분리 (RLS)

## 🛠️ 설치 및 설정

### 1. Supabase 프로젝트 생성

1. [Supabase](https://supabase.com)에 가입하고 새 프로젝트 생성
2. 프로젝트 URL과 anon key 복사

### 2. 데이터베이스 테이블 생성

Supabase SQL 편집기에서 다음 SQL 실행:

```sql
-- tags 테이블 생성
CREATE TABLE tags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3182F6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    UNIQUE(user_id, name)
);

-- tasks 테이블 생성 (tag_id, priority 컬럼 포함)
CREATE TABLE tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL,
    is_complete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE SET NULL,
    priority TEXT DEFAULT 'low' CHECK (priority IN ('high', 'medium', 'low'))
);

-- RLS 활성화
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- tasks RLS 정책 설정
CREATE POLICY "Users can view own tasks" ON tasks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks" ON tasks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks" ON tasks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks" ON tasks
    FOR DELETE USING (auth.uid() = user_id);

-- tags RLS 정책 설정
CREATE POLICY "Users can view own tags" ON tags
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tags" ON tags
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tags" ON tags
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tags" ON tags
    FOR DELETE USING (auth.uid() = user_id);

-- task_details 테이블 생성 (할 일 상세 정보)
CREATE TABLE task_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE UNIQUE,
    description TEXT NOT NULL,
    deadline TIMESTAMP WITH TIME ZONE,
    estimated_time INTEGER, -- 분 단위
    notes TEXT,
    requires_review BOOLEAN DEFAULT FALSE,
    is_recurring BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE task_details ENABLE ROW LEVEL SECURITY;

-- task_details RLS 정책 설정
CREATE POLICY "Users can view own task details" ON task_details
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.id = task_details.task_id 
            AND tasks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own task details" ON task_details
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.id = task_details.task_id 
            AND tasks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own task details" ON task_details
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.id = task_details.task_id 
            AND tasks.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own task details" ON task_details
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM tasks 
            WHERE tasks.id = task_details.task_id 
            AND tasks.user_id = auth.uid()
        )
    );

-- 인덱스 생성 (성능 최적화)
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX idx_tasks_tag_id ON tasks(tag_id);
CREATE INDEX idx_tags_user_id ON tags(user_id);
CREATE INDEX idx_tags_name ON tags(name);
CREATE INDEX idx_task_details_task_id ON task_details(task_id);
```

### 3. 환경 설정

`supabase-client.js` 파일에서 다음 값들을 실제 프로젝트 값으로 변경:

```javascript
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
```

### 4. 로컬 서버 실행

```bash
# Python 3
python -m http.server 8000

# Node.js
npx serve .

# PHP
php -S localhost:8000
```

브라우저에서 `http://localhost:8000` 접속

## 🎯 사용법

### 기본 조작
- **할 일 추가**: 입력 필드에 텍스트 입력 → 우선순위 선택 → 태그 선택 → Enter 또는 + 버튼 클릭
- **완료 체크**: 체크박스 클릭
- **삭제**: 할 일 항목에 마우스 오버 시 나타나는 휴지통 아이콘 클릭
- **필터링**: 상단 탭으로 전체/진행중/완료된 할 일 필터링
- **우선순위별 필터링**: 하단 우선순위 버튼으로 특정 우선순위의 할 일만 표시
- **태그별 필터링**: 하단 태그 버튼으로 특정 태그의 할 일만 표시

### 우선순위 관리
- **우선순위 설정**: 할 일 등록 시 색상 버튼으로 선택 (높음: 빨간색, 보통: 노란색, 낮음: 흰색)
- **우선순위 변경**: 할 일 목록에서 연필 아이콘 클릭 → 우선순위 선택 모달에서 변경

### 상세 정보 관리
- **상세 정보 입력**: 할 일 목록에서 상세 버튼(📋) 클릭 → 상세 모달에서 정보 입력
- **상세 정보 항목**: 
  - 상세 설명 (필수)
  - 마감일
  - 예상 소요시간
  - 추가 메모
  - 검토 필요 여부
  - 반복 작업 여부
- **저장 및 수정**: 상세 정보는 자동 저장되며, 언제든지 수정 가능

### 태그 관리
- **태그 추가**: "태그 관리" 버튼 클릭 → 새 태그 이름 입력 → 추가
- **태그 수정**: 태그 관리 모달에서 연필 아이콘 클릭 → 이름 수정 → Enter 또는 포커스 아웃
- **태그 삭제**: 태그 관리 모달에서 휴지통 아이콘 클릭 → 확인

### 키보드 단축키
- `Ctrl/Cmd + Enter`: 할 일 추가
- `Escape`: 입력 필드 초기화

## 🔧 커스터마이징

### 색상 변경
`style.css`에서 CSS 변수 수정:

```css
:root {
    --toss-blue: #3182F6;
    --toss-gray: #F8F9FA;
    --toss-dark: #1E293B;
}
```

### 폰트 변경
`index.html`의 Tailwind 설정에서 폰트 패밀리 수정:

```javascript
fontFamily: {
    'sans': ['원하는 폰트', 'fallback 폰트들']
}
```

## 📱 반응형 디자인

- **모바일**: 480px 이하에서 최적화된 레이아웃
- **태블릿**: 768px 이하에서 적응형 디자인
- **데스크톱**: 1024px 이상에서 최적화된 뷰

## 🌙 다크 모드

시스템 설정에 따라 자동으로 다크 모드 적용:
- 라이트 모드: 밝은 배경, 어두운 텍스트
- 다크 모드: 어두운 배경, 밝은 텍스트

## 🔒 보안

- **RLS (Row Level Security)**: 사용자별 데이터 접근 제한
- **익명 인증**: 별도 계정 없이도 사용 가능
- **XSS 방지**: HTML 이스케이프 처리
- **CSRF 보호**: Supabase 내장 보안 기능

## 🚀 배포

### 정적 호스팅
- **Vercel**: `vercel --prod`
- **Netlify**: `netlify deploy --prod`
- **GitHub Pages**: GitHub Actions로 자동 배포

### 환경 변수 설정
배포 시 다음 환경 변수 설정:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🐛 문제 해결

### 일반적인 문제들

1. **Supabase 연결 실패**
   - URL과 API 키 확인
   - 네트워크 연결 상태 확인

2. **할 일이 저장되지 않음**
   - RLS 정책 확인
   - 사용자 인증 상태 확인

3. **실시간 동기화 작동 안함**
   - Supabase Realtime 설정 확인
   - 네트워크 방화벽 설정 확인

## 📄 라이선스

MIT License

## 🤝 기여

버그 리포트, 기능 제안, 풀 리퀘스트 환영합니다!

## 📞 지원

문제가 있거나 질문이 있으시면 이슈를 생성해주세요. 
