library(tidyverse)
library(readxl)
library(RColorBrewer)
url <- "https://journals.plos.org/plosgenetics/article/file?type=supplementary&id=info:doi/10.1371/journal.pgen.1007148.s013"
file <- tempfile()
download.file(url = url, destfile = file)

data <- read_xlsx(
    file,
    sheet = "RNAseq",
    skip = 2) %>%
    select(ccna = `CCNA number`, logfc = `log2(Pxyl_dnaKJ (9 h glu)/Pxyl_dnaKJ (xyl))`) %>%
    filter(!is.na(logfc))

lowest <- min(data$logfc)
highest <- max(data$logfc)

colours <- brewer.pal("RdYlGn", n=3)

down <- colorRamp(colours[2:1])
up <- colorRamp(colours[2:3])

data$colour <- sapply(data$logfc, function(logfc) {
    col <- if (logfc > 0)
               up(logfc/highest)
           else
               down(logfc/lowest)
    rgb(col[,1], col[,2], col[,3], maxColorValue=255)
})

data %>%
    select(ccna, colour) %>%
    write.table("static/schramm_data.txt", row.names = FALSE, col.names = FALSE, quote = FALSE)
