package me.kafuuneko.rpclient.libs.room.migration

import androidx.room.DeleteTable
import androidx.room.migration.AutoMigrationSpec
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * 主业务数据库 v1→v2 自动迁移所需的删表消歧义声明。
 *
 * 历史请求日志可能包含升级前写入的原始载荷，因此允许 Room 删除旧日志表；
 * Room 根据已导出的 v1/v2 schema 生成迁移，其余业务表继续接受 schema 校验。v1 中本地
 * 新建世界书的默认预算 25 表示全局输入预算的 25%，v2 改用 0 表示跟随全局，因此迁移时
 * 同步转换旧默认值；其他显式预算值保持不变。
 */
@DeleteTable(tableName = "llm_request_logs")
class AppDatabaseAutoMigration1To2Spec : AutoMigrationSpec {
    override fun onPostMigrate(db: SupportSQLiteDatabase) {
        db.execSQL("UPDATE lorebooks SET tokenBudget = 0 WHERE tokenBudget = 25")
    }
}

/**
 * v2→v3 自动迁移：为 chat_sessions 和 group_chat_sessions 添加 isPinned 列。
 *
 * Room 能自动处理带默认值的新增列，本 spec 为空占位。
 */
class AppDatabaseAutoMigration2To3Spec : AutoMigrationSpec
