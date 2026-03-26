# full_workflow.R
# End-to-end survival analysis: KM + Cox + PH check + Forest plot.
# Assumes `data` is already loaded (run load_example_data.R first).

library(survival)
library(survminer)
library(dplyr)
library(broom)

cat("=== 生存分析完整流程 ===\n\n")

# ── 0. Data validation ────────────────────────────────────────────────────────
stopifnot(
  "time"   %in% names(data),
  "status" %in% names(data),
  "group"  %in% names(data),
  all(data$status %in% c(0, 1)),
  all(data$time > 0)
)
cat(sprintf("✓ 数据验证通过: %d 例 | 事件: %d (%.1f%%) | 中位随访: %.1f 月\n\n",
  nrow(data), sum(data$status),
  mean(data$status) * 100, median(data$time)))

# ── 1. Kaplan-Meier ───────────────────────────────────────────────────────────
surv_obj <- Surv(time = data$time, event = data$status)
km_fit   <- survfit(surv_obj ~ group, data = data)

cat("--- Kaplan-Meier 中位生存时间 ---\n")
print(summary(km_fit)$table[, c("median", "0.95LCL", "0.95UCL")])

logrank <- survdiff(surv_obj ~ group, data = data)
p_lr    <- 1 - pchisq(logrank$chisq, df = length(levels(factor(data$group))) - 1)
cat(sprintf("\nLog-rank p 值: %.4f %s\n\n", p_lr,
  ifelse(p_lr < 0.05, "✓ 显著", "（不显著）")))

km_plot <- ggsurvplot(
  km_fit, data = data,
  pval = TRUE, conf.int = TRUE, risk.table = TRUE,
  risk.table.height = 0.25,
  xlab = "时间（月）", ylab = "生存概率",
  palette = c("#E64B35", "#4DBBD5"),
  ggtheme = theme_bw(base_size = 13),
  surv.median.line = "hv",
  break.time.by = 12
)
ggsave("km_curve.pdf", plot = print(km_plot), width = 8, height = 7)
cat("✓ KM 曲线已保存: km_curve.pdf\n\n")

# ── 2. Univariate Cox ─────────────────────────────────────────────────────────
covariates <- intersect(c("group", "age", "stage", "gender"), names(data))
cat("--- 单变量 Cox 回归 ---\n")
uni_results <- lapply(covariates, function(var) {
  fit <- coxph(as.formula(paste("surv_obj ~", var)), data = data)
  tidy(fit, exponentiate = TRUE, conf.int = TRUE) %>% mutate(variable = var)
})
uni_df <- do.call(rbind, uni_results)
print(uni_df[, c("term", "estimate", "conf.low", "conf.high", "p.value")])

sig_vars <- unique(uni_df$term[uni_df$p.value < 0.05])
cat(sprintf("\n显著变量 (p<0.05): %s\n\n",
  if (length(sig_vars) > 0) paste(sig_vars, collapse = ", ") else "无"))

# ── 3. Multivariate Cox ───────────────────────────────────────────────────────
if (length(sig_vars) >= 2) {
  cat("--- 多变量 Cox 回归 ---\n")
  multi_formula <- as.formula(paste("surv_obj ~", paste(sig_vars, collapse = " + ")))
  cox_multi     <- coxph(multi_formula, data = data)
  print(summary(cox_multi))

  multi_df <- tidy(cox_multi, exponentiate = TRUE, conf.int = TRUE)
  write.csv(multi_df, "cox_results.csv", row.names = FALSE)
  cat("✓ Cox 结果已保存: cox_results.csv\n")

  # Forest plot
  source("scripts/plot_forest.R")
  plot_cox_forest(multi_df, output = "cox_forest.pdf")

  # PH assumption check
  cat("\n--- 比例风险假设检验 ---\n")
  ph_test <- cox.zph(cox_multi)
  print(ph_test)
  sink("ph_test.txt"); print(ph_test); sink()
  cat("✓ PH 检验结果已保存: ph_test.txt\n")

  if (any(ph_test$table[, "p"] < 0.05)) {
    cat("⚠ 部分变量违反 PH 假设，建议使用分层 Cox 或时间交互项\n")
  } else {
    cat("✓ 所有变量满足比例风险假设\n")
  }
} else {
  cat("⚠ 显著变量不足 2 个，跳过多变量 Cox 回归\n")
}

cat("\n=== 分析完成 ===\n")
cat("输出文件: km_curve.pdf, cox_forest.pdf, cox_results.csv, ph_test.txt\n")
