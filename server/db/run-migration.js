/**
 * 마이그레이션 실행 스크립트
 *
 * Usage: node server/db/run-migration.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// 환경 변수에서 DB 설정 가져오기
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hellpme',
});

async function runMigration() {
  const migrationFile = path.join(__dirname, 'migrations', '001_create_admin_views.sql');

  console.log('🚀 관리자 뷰 마이그레이션 시작...\n');

  try {
    // SQL 파일 읽기
    const sql = fs.readFileSync(migrationFile, 'utf8');

    // 실행
    await pool.query(sql);

    console.log('✅ 마이그레이션 완료!\n');

    // 생성된 뷰 확인
    console.log('📊 생성된 뷰 확인:\n');

    const views = await pool.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
      AND table_name LIKE '%view'
      ORDER BY table_name;
    `);

    views.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });

    console.log('\n🔍 작업 대기함 데이터 샘플:\n');

    const taskQueue = await pool.query('SELECT * FROM task_queue_view LIMIT 5;');

    if (taskQueue.rows.length > 0) {
      console.log(`   발견된 작업: ${taskQueue.rows.length}개`);
      taskQueue.rows.forEach(task => {
        console.log(`   - [${task.task_type}] 우선순위: ${task.priority}, 대기: ${Math.round(task.waiting_minutes)}분`);
      });
    } else {
      console.log('   (현재 대기 중인 작업 없음)');
    }

    console.log('\n📈 실시간 통계:\n');

    const stats = await pool.query('SELECT * FROM admin_stats_view;');

    if (stats.rows.length > 0) {
      const s = stats.rows[0];
      console.log(`   - 진행 중 오더: ${s.active_orders}개`);
      console.log(`   - 활성 헬퍼: ${s.active_helpers}명`);
      console.log(`   - 승인 대기 정산: ₩${Number(s.pending_settlement_total).toLocaleString()}`);
      console.log(`   - 오늘의 수익: ₩${Number(s.today_revenue).toLocaleString()}`);
    }

    console.log('\n✨ 마이그레이션 성공적으로 완료되었습니다!\n');

  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
