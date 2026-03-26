---
id: survival-analysis-clinical
name: Clinical Survival & Outcome Analysis
category: clinical
short-description: Kaplan-Meier survival curves, log-rank tests, Cox proportional hazards regression, and competing risks analysis for clinical outcome data.
detailed-description: Complete survival analysis workflow covering Kaplan-Meier estimation, log-rank/Wilcoxon tests, univariate and multivariate Cox regression, proportional hazards assumption diagnostics, time-dependent ROC, and competing risks (Fine-Gray model). Handles right-censored data, stratified analyses, and produces publication-ready figures. Use when you have time-to-event data (OS, PFS, DFS, RFS) with censoring indicators.
starting-prompt: Perform survival analysis on my clinical outcome data with Kaplan-Meier curves and Cox regression.
---

# 临床生存分析工作流

Kaplan-Meier 生存曲线 + Cox 回归 + 竞争风险模型，适用于 OS/PFS/DFS 等临床终点分析。

## 适用场景

- ✅ **时间-事件数据**：总生存期（OS）、无进展生存期（PFS）、无病生存期（DFS）
- ✅ **右删失数据**（right-censored）：患者失访或研究结束时未发生事件
- ✅ **分组比较**：治疗组 vs 对照组、高表达 vs 低表达、突变 vs 野生型
- ✅ **多变量校正**：年龄、分期、治疗方案等协变量的 Cox 回归
- ✅ **竞争风险**：存在多种终点事件时（如死亡 vs 复发）

**不适用：**
- ❌ 无删失信息的数据（需要删失指示变量）
- ❌ 重复事件数据 → 使用 Andersen-Gill 模型

---

## 快速开始（示例数据）

```r
# 安装依赖
options(repos = c(CRAN = "https://cloud.r-project.org"))
install.packages(c("survival", "survminer", "ggplot2", "dplyr", "broom",
                   "timeROC", "cmprsk", "forestplot"))

# 加载示例数据（TCGA LUAD 肺腺癌，228例）
source("scripts/load_example_data.R")
data <- load_tcga_luad_example()
# data$time   : 生存时间（月）
# data$status : 事件指示（1=死亡, 0=删失）
# data$group  : 分组变量（High/Low 表达）
# data$age, data$stage, data$gender : 协变量

# 运行完整分析
source("scripts/full_workflow.R")
```

---

## 数据格式要求

```r
# 最小必需列：
head(data)
#   patient_id  time  status  group
#   TCGA-001    24.3  1       High
#   TCGA-002    48.0  0       Low    # 0 = 删失（censored）
#   TCGA-003    12.1  1       High

# 检查数据完整性（分析前必做）
stopifnot(
  all(data$status %in% c(0, 1)),          # 状态只能是 0 或 1
  all(data$time > 0),                      # 时间必须为正数
  !any(is.na(data$time)),                  # 时间不能有缺失
  !any(is.na(data$status))                 # 状态不能有缺失
)
cat(sprintf("样本数: %d | 事件数: %d (%.1f%%) | 中位随访: %.1f 月\n",
  nrow(data), sum(data$status),
  mean(data$status) * 100,
  median(data$time)))
```

---

## 第一步：Kaplan-Meier 生存曲线

```r
library(survival)
library(survminer)

# 构建生存对象
surv_obj <- Surv(time = data$time, event = data$status)

# KM 拟合（按分组）
km_fit <- survfit(surv_obj ~ group, data = data)

# 打印中位生存时间 + 95% CI
print(km_fit)
summary(km_fit)$table  # 各组中位生存时间

# 绘制 KM 曲线（出版级）
km_plot <- ggsurvplot(
  km_fit,
  data          = data,
  pval          = TRUE,          # 显示 log-rank p 值
  pval.method   = TRUE,          # 显示检验方法
  conf.int      = TRUE,          # 95% 置信区间
  risk.table    = TRUE,          # 风险表（at-risk numbers）
  risk.table.height = 0.25,
  xlab          = "时间（月）",
  ylab          = "生存概率",
  legend.labs   = levels(factor(data$group)),
  palette       = c("#E64B35", "#4DBBD5"),  # 红蓝配色
  ggtheme       = theme_bw(base_size = 14),
  surv.median.line = "hv",       # 标注中位生存线
  break.time.by = 12             # X 轴每 12 月一个刻度
)
print(km_plot)
ggsave("km_curve.pdf", plot = print(km_plot), width = 8, height = 7)
cat("✓ KM 曲线已保存: km_curve.pdf\n")
```

### Log-rank 检验

```r
# 标准 log-rank 检验（对晚期差异更敏感）
logrank_test <- survdiff(surv_obj ~ group, data = data)
p_logrank <- 1 - pchisq(logrank_test$chisq, df = length(levels(factor(data$group))) - 1)
cat(sprintf("Log-rank p 值: %.4f\n", p_logrank))

# Wilcoxon 检验（对早期差异更敏感，rho=1）
wilcox_test <- survdiff(surv_obj ~ group, data = data, rho = 1)
p_wilcox <- 1 - pchisq(wilcox_test$chisq, df = 1)
cat(sprintf("Wilcoxon p 值: %.4f\n", p_wilcox))
```

---

## 第二步：单变量 Cox 回归

```r
library(broom)

# 单变量 Cox（逐个变量）
covariates <- c("group", "age", "stage", "gender")
uni_results <- lapply(covariates, function(var) {
  formula <- as.formula(paste("surv_obj ~", var))
  fit <- coxph(formula, data = data)
  tidy(fit, exponentiate = TRUE, conf.int = TRUE) %>%
    mutate(variable = var)
})
uni_df <- do.call(rbind, uni_results)

# 打印结果（HR + 95%CI + p值）
cat("\n=== 单变量 Cox 回归结果 ===\n")
print(uni_df[, c("variable", "term", "estimate", "conf.low", "conf.high", "p.value")])

# 筛选 p < 0.05 的变量进入多变量模型
sig_vars <- uni_df$term[uni_df$p.value < 0.05]
cat(sprintf("\n显著变量 (p<0.05): %s\n", paste(sig_vars, collapse = ", ")))
```

---

## 第三步：多变量 Cox 回归

```r
# 多变量 Cox（纳入单变量显著变量）
multi_formula <- as.formula(paste("surv_obj ~", paste(sig_vars, collapse = " + ")))
cox_multi <- coxph(multi_formula, data = data)

# 结果摘要
cat("\n=== 多变量 Cox 回归结果 ===\n")
print(summary(cox_multi))

# 提取 HR 表格
multi_df <- tidy(cox_multi, exponentiate = TRUE, conf.int = TRUE)
cat("\nHazard Ratio 汇总:\n")
print(multi_df[, c("term", "estimate", "conf.low", "conf.high", "p.value")])

# 森林图
library(forestplot)
source("scripts/plot_forest.R")
plot_cox_forest(multi_df, output = "cox_forest.pdf")
cat("✓ 森林图已保存: cox_forest.pdf\n")
```

### 比例风险假设检验（PH assumption）

```r
# Schoenfeld 残差检验（p > 0.05 表示满足 PH 假设）
ph_test <- cox.zph(cox_multi)
print(ph_test)

if (any(ph_test$table[, "p"] < 0.05)) {
  cat("⚠ 以下变量违反比例风险假设，考虑分层 Cox 或时间交互项:\n")
  print(ph_test$table[ph_test$table[, "p"] < 0.05, ])
} else {
  cat("✓ 所有变量满足比例风险假设\n")
}

# 绘制 Schoenfeld 残差图
ggcoxzph(ph_test)
```

---

## 第四步：最优截断值（连续变量分组）

```r
# 当分组变量是连续值（如基因表达量）时，寻找最优截断点
library(survminer)

# 方法1：surv_cutpoint（最大化 log-rank 统计量）
cut_result <- surv_cutpoint(
  data,
  time    = "time",
  event   = "status",
  variables = "expression_value"  # 替换为你的连续变量名
)
print(summary(cut_result))
optimal_cutoff <- cut_result$cutpoint$cutpoint
cat(sprintf("最优截断值: %.3f\n", optimal_cutoff))

# 按截断值分组
data$group_cut <- ifelse(data$expression_value >= optimal_cutoff, "High", "Low")

# 重新绘制 KM 曲线
km_fit2 <- survfit(Surv(time, status) ~ group_cut, data = data)
ggsurvplot(km_fit2, data = data, pval = TRUE, risk.table = TRUE)
```

---

## 第五步：竞争风险分析（Fine-Gray 模型）

```r
# 当存在竞争事件时（如：关注复发，但患者可能先死亡）
# status: 0=删失, 1=目标事件（复发）, 2=竞争事件（死亡）
library(cmprsk)

# 累积发生函数（CIF）
cif_fit <- cuminc(
  ftime   = data$time,
  fstatus = data$status_competing,  # 0/1/2
  group   = data$group
)

# 绘制 CIF 曲线
plot(cif_fit, col = c("#E64B35", "#4DBBD5", "#00A087", "#3C5488"),
     xlab = "时间（月）", ylab = "累积发生率",
     main = "竞争风险累积发生函数")

# Fine-Gray 回归（仅针对目标事件）
fg_model <- crr(
  ftime   = data$time,
  fstatus = data$status_competing,
  cov1    = model.matrix(~ group + age + stage, data = data)[, -1]
)
summary(fg_model)
```

---

## 第六步：时间依赖 ROC（预测性能评估）

```r
library(timeROC)

# 评估 Cox 模型在不同时间点的预测性能
risk_score <- predict(cox_multi, type = "risk")

roc_result <- timeROC(
  T       = data$time,
  delta   = data$status,
  marker  = risk_score,
  cause   = 1,
  times   = c(12, 24, 36, 60),  # 1年、2年、3年、5年 AUC
  iid     = TRUE
)

cat("\n=== 时间依赖 AUC ===\n")
print(roc_result$AUC)

# 绘制 ROC 曲线
plot(roc_result, time = 36, title = "3年生存预测 ROC 曲线")
```

---

## 结果解读指南

| 指标 | 含义 | 注意事项 |
|------|------|---------|
| **HR > 1** | 风险增加（预后差） | 需同时看 95% CI 和 p 值 |
| **HR < 1** | 风险降低（保护因素） | HR=0.5 表示风险降低 50% |
| **p < 0.05** | 统计显著 | 多重比较时需 FDR 校正 |
| **中位生存时间** | 50% 患者存活的时间 | 若曲线未降至 0.5 则无法估计 |
| **Log-rank p** | 两组生存曲线是否有差异 | 对晚期差异更敏感 |
| **C-index** | Cox 模型区分度（0.5=随机，1=完美） | >0.7 认为有较好预测性能 |

---

## 常见错误与解决方案

**错误1：`Error in Surv(): time must be positive`**
```r
# 检查并移除时间为 0 或负数的行
data <- data[data$time > 0, ]
```

**错误2：KM 曲线置信区间异常宽**
```r
# 样本量不足，考虑合并分组或报告时注明样本量限制
# 检查各组样本量
table(data$group)
```

**错误3：Cox 模型不收敛**
```r
# 可能存在完全分离（某变量完全预测事件）
# 检查各协变量与事件的交叉表
table(data$group, data$status)
# 考虑 Firth 惩罚 Cox 回归
library(coxphf)
cox_firth <- coxphf(surv_obj ~ group + age, data = data)
```

**错误4：违反比例风险假设**
```r
# 方案1：分层 Cox（按违反变量分层）
cox_strat <- coxph(surv_obj ~ group + strata(stage), data = data)

# 方案2：加入时间交互项
cox_time <- coxph(surv_obj ~ group + tt(group), data = data,
                  tt = function(x, t, ...) x * log(t))
```

---

## 输出文件清单

| 文件 | 内容 |
|------|------|
| `km_curve.pdf` | Kaplan-Meier 生存曲线（含风险表） |
| `cox_forest.pdf` | Cox 回归森林图（HR + 95%CI） |
| `cox_results.csv` | 多变量 Cox 回归完整结果表 |
| `ph_test.txt` | 比例风险假设检验结果 |
| `roc_auc.csv` | 时间依赖 AUC 表格 |

---

## 参考文献

- Kaplan EL, Meier P. (1958) Nonparametric estimation from incomplete observations. *JASA*.
- Cox DR. (1972) Regression models and life-tables. *JRSS-B*.
- Fine JP, Gray RJ. (1999) A proportional hazards model for the subdistribution of a competing risk. *JASA*.
- Therneau TM, Grambsch PM. (2000) *Modeling Survival Data: Extending the Cox Model*. Springer.
