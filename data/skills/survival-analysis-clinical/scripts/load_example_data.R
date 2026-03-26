# load_example_data.R
# Loads a simulated TCGA-LUAD-style survival dataset for testing the workflow.
# No internet connection required — data is generated deterministically.

load_tcga_luad_example <- function(n = 228, seed = 42) {
  set.seed(seed)

  # Simulate clinical covariates
  age    <- round(rnorm(n, mean = 63, sd = 10))
  gender <- sample(c("Male", "Female"), n, replace = TRUE, prob = c(0.55, 0.45))
  stage  <- sample(c("I", "II", "III", "IV"), n, replace = TRUE,
                   prob = c(0.30, 0.25, 0.25, 0.20))

  # Simulate gene expression (continuous, used for cutpoint demo)
  expression_value <- rnorm(n, mean = 5, sd = 2)

  # Assign group based on expression (High/Low)
  group <- ifelse(expression_value >= median(expression_value), "High", "Low")

  # Simulate survival times with group effect (High = worse prognosis)
  lambda_high <- 0.035
  lambda_low  <- 0.020
  lambda <- ifelse(group == "High", lambda_high, lambda_low)

  # Add stage effect
  stage_mult <- c("I" = 0.6, "II" = 0.9, "III" = 1.2, "IV" = 1.8)
  lambda <- lambda * stage_mult[stage]

  # Exponential survival times
  true_time <- rexp(n, rate = lambda)

  # Administrative censoring at 60 months
  censor_time <- runif(n, min = 6, max = 60)
  time   <- pmin(true_time, censor_time)
  status <- as.integer(true_time <= censor_time)

  # Competing risks version (0=censored, 1=death from cancer, 2=other death)
  status_competing <- status
  other_death_idx  <- which(status == 1 & runif(sum(status == 1)) < 0.15)
  status_competing[other_death_idx] <- 2

  data <- data.frame(
    patient_id       = paste0("TCGA-", sprintf("%03d", seq_len(n))),
    time             = round(time, 1),
    status           = status,
    status_competing = status_competing,
    group            = group,
    expression_value = round(expression_value, 3),
    age              = age,
    gender           = gender,
    stage            = stage,
    stringsAsFactors = FALSE
  )

  cat(sprintf(
    "✓ 示例数据已加载: %d 例 | 事件数: %d (%.1f%%) | 中位随访: %.1f 月\n",
    nrow(data), sum(data$status),
    mean(data$status) * 100,
    median(data$time)
  ))
  cat(sprintf("  分组: High=%d, Low=%d\n",
    sum(data$group == "High"), sum(data$group == "Low")))

  return(data)
}
