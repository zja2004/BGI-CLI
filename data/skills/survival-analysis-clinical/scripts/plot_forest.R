# plot_forest.R
# Generates a publication-ready Cox regression forest plot.

plot_cox_forest <- function(cox_df, output = "cox_forest.pdf",
                             title = "多变量 Cox 回归森林图") {
  library(ggplot2)

  # Clean up term names for display
  cox_df$label <- gsub("stage", "分期: ", cox_df$term)
  cox_df$label <- gsub("gender", "性别: ", cox_df$label)
  cox_df$label <- gsub("group", "分组: ", cox_df$label)
  cox_df$label <- gsub("age", "年龄", cox_df$label)

  # Significance stars
  cox_df$sig <- ifelse(cox_df$p.value < 0.001, "***",
                ifelse(cox_df$p.value < 0.01,  "**",
                ifelse(cox_df$p.value < 0.05,  "*", "")))

  cox_df$label_full <- paste0(cox_df$label, " ", cox_df$sig)

  p <- ggplot(cox_df, aes(x = estimate, y = reorder(label_full, estimate))) +
    geom_vline(xintercept = 1, linetype = "dashed", color = "grey50", linewidth = 0.5) +
    geom_errorbarh(aes(xmin = conf.low, xmax = conf.high),
                   height = 0.2, color = "grey40", linewidth = 0.7) +
    geom_point(aes(color = p.value < 0.05), size = 3) +
    scale_color_manual(values = c("TRUE" = "#E64B35", "FALSE" = "#4DBBD5"),
                       labels = c("TRUE" = "p < 0.05", "FALSE" = "p ≥ 0.05"),
                       name = "显著性") +
    scale_x_log10() +
    labs(
      title    = title,
      x        = "风险比 (HR, 95% CI)",
      y        = NULL,
      caption  = "* p<0.05  ** p<0.01  *** p<0.001"
    ) +
    theme_bw(base_size = 13) +
    theme(
      panel.grid.minor = element_blank(),
      plot.title       = element_text(face = "bold"),
      legend.position  = "bottom"
    )

  ggsave(output, plot = p, width = 7, height = max(3, nrow(cox_df) * 0.5 + 2))
  cat(sprintf("✓ 森林图已保存: %s\n", output))
  return(p)
}
