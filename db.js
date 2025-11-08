const mysql = require('mysql2/promise');
require('dotenv').config();

const rbpool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  port: Number(process.env.DB_PORT), 
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 100,
  queueLimit: 0
});

module.exports = rbpool;



// // db.js
// //DB 연결용 파일
// const MariaDB = require('mariadb'); //MariaDB 통신을 위해 mysql2 라이브러리를 불러옴
// require('dotenv').config();//.env 파일을 읽어오기 위해 dotenv 도 불러와야함.

// const rbpool = MariaDB.createPool({
//   host: process.env.DB_HOST, //.env에 적은 localhost
//   user: process.env.DB_USER, // -- DB 사용자명
//   password: process.env.DB_PASSWORD, // -- 비밀번호
//   database: process.env.DB_DATABASE, // -- DB 이름
//   waitForConnections: true,
//   connectionLimit: 100, // 한 번에 최대 100명까지 접속 가능
//   queueLimit: 0,
  
// });

// module.exports = rbpool; //pool 파일을 server.js 등에서도 가져다 쓸 수 있게 내보내는 것