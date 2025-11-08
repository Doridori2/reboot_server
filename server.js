// server.js

const express = require('express'); //express라는 프레임워크를 불러옴 -> 서버를 빠르게 만들 수 있게 도와주는 라이브러리
const cors = require('cors');
const morgan = require('morgan');             
require('dotenv').config(); 
const rbapp = express(); //app 객체 생성
const PORT = process.env.PORT || 3000; // 서버가 열릴 주소의 번호 (localhost:3000)


rbapp.use(cors({ origin: true }));   //미들웨어가 라우터보다 앞에 있어야함

const usersRouter = require('./routes/users'); // users 라우터 파일을 불러옵니다.
rbapp.use(express.json()); //클라이언트에서 서버로 데이터를 보낼 때 JSON 형식. 이걸 자동을 읽어줄 수 있게 설정
rbapp.use('/users', usersRouter); // /users 경로에서 users.js의 라우터 사용
rbapp.use(morgan('dev'));

const authRouter = require('./routes/auth'); // auth 라우터 파일을 불러옵니다.
rbapp.use('/auth', authRouter); // /auth 경로에서 auth.js의 라우터 사용

const missionsRouter = require('./routes/missions'); //missions 라우터 파일을 불러옵니다.
rbapp.use('/missions', missionsRouter); // /missions 경로에서 missions.js의 라우터 사용

const actionsRouter = require('./routes/actions'); // actions라우터 파일을 불러옵니다.
rbapp.use('/actions', actionsRouter); // /actions 경로에서 actions.js의 라우터 사용

const statusRouter = require('./routes/status'); // status라우터 파일을 불러옵니다.
rbapp.use('/status', statusRouter); // /status경로에서 status.js의 라우터 사용

const notiRouter = require('./routes/notifications'); // notifications라우터 파일을 불러옵니다.
rbapp.use('/notifications', notiRouter); // /notifications 경로에서 notifications.js의 라우터 사용

const reportsRouter = require('./routes/reports'); // reports라우터 파일을 불러옵니다.
rbapp.use('/reports', reportsRouter); // /reports 경로에서 reports.js의 라우터 사용

const postsRouter = require('./routes/posts');        // 게시판(한 줄 글) 라우터
rbapp.use('/posts', postsRouter);                     // /posts 경로와 연결

const reactionsRouter = require('./routes/reactions'); // 이모지 반응 라우터
rbapp.use('/posts', reactionsRouter);                  // /posts/:id/reactions 같이 posts 밑에 연결

const topicsRouter = require('./routes/topics');       // 오늘의 주제 라우터
rbapp.use('/topics', topicsRouter);                    // /topics 경로와 연결

rbapp.get('/health', (_, res) => res.json({ ok: true })); //헬스체크 라우트 미리 추가

// 기본 테스트용 라우트
rbapp.get('/', (req, res) => {
  res.send('Reboot Server Running hoho!'); //경로로 접속했을때 응답. 테스트용 엔드포인트
});



// 404 처리 라우터 (존재하지 않는 경로로 접근 시)
// rbapp.use((req, res, next) => {
//   res.status(404).json({ message: '잘못된 경로입니다' });
// });

// 서버 실행
rbapp.listen(PORT, '0.0.0.0', () => {
  console.log(`서버가 모든 네트워크에서 열렸습니다: http://0.0.0.0:${PORT}`);
});
//listen은 서버를 켜는 함수, 포트 3000번으로 서버를 켜고, 켜지면 터비널에 글을 콘솔에 찍어준다.