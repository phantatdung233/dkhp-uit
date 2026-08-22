"use client";

/**
 * Modal nhập danh sách mã lớp học phần để xếp nhanh vào lịch biểu hiện tại.
 * Thiết kế giao diện hiện đại, đồng bộ với hệ thống modal chuẩn của ứng dụng.
 */

import React, { useState, useMemo } from "react";
import {
  Download,
  Clipboard,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  Layers,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ImportClassCodesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (codes: string) => string[];
}

export function ImportClassCodesModal({
  open,
  onOpenChange,
  onImport,
}: ImportClassCodesModalProps) {
  const [classCodesText, setClassCodesText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  // Tách và đếm số lượng mã lớp nhận diện được theo thời gian thực
  const parsedCodes = useMemo(() => {
    return classCodesText
      .split(/[\n,;]+/)
      .map((code) => code.trim())
      .filter((code) => code.length > 0);
  }, [classCodesText]);

  // Xử lý dán từ clipboard
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setClassCodesText(text);
        setErrors([]);
        toast.success("Đã dán nội dung từ clipboard");
      }
    } catch {
      toast.error("Không thể truy cập bộ nhớ tạm");
    }
  };

  // Xử lý gửi danh sách mã lớp
  const handleConfirmImport = () => {
    if (!classCodesText.trim()) {
      toast.error("Vui lòng nhập danh sách mã lớp");
      return;
    }

    const importErrors = onImport(classCodesText);
    if (importErrors && importErrors.length > 0) {
      setErrors(importErrors);
    } else {
      setClassCodesText("");
      setErrors([]);
      onOpenChange(false);
    }
  };

  // Đóng modal và reset
  const handleClose = () => {
    onOpenChange(false);
    setErrors([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[92vh] flex flex-col p-0 overflow-hidden gap-0 rounded-2xl border shadow-2xl">
        {/* Top Header Banner */}
        <DialogHeader className="p-4 sm:p-5 pr-10 sm:pr-12 border-b bg-gradient-to-r from-emerald-500/10 via-primary/5 to-background shrink-0 space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-2xs">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                Nhập mã lớp học phần
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Dán danh sách mã lớp để tự động xếp nhanh vào thời khóa biểu hiện tại
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content Area */}
        <ScrollArea className="flex-1 max-h-[60vh] p-4 sm:p-5">
          <div className="space-y-3.5">
            {/* Input Toolbar */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">
                  Danh sách mã lớp
                </span>
                <Badge
                  variant={parsedCodes.length > 0 ? "info" : "secondary"}
                  className="text-[10px] font-bold px-2 py-0.5"
                >
                  {parsedCodes.length > 0
                    ? `Đã nhận diện: ${parsedCodes.length} mã`
                    : "Chưa có mã lớp"}
                </Badge>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-2xs"
                  title="Dán từ bộ nhớ tạm"
                >
                  <Clipboard className="h-3.5 w-3.5" />
                  <span>Dán</span>
                </button>

                {classCodesText && (
                  <button
                    type="button"
                    onClick={() => {
                      setClassCodesText("");
                      setErrors([]);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium bg-background hover:bg-muted text-muted-foreground hover:text-destructive transition-all cursor-pointer shadow-2xs"
                    title="Xóa trắng nội dung"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Xóa</span>
                  </button>
                )}
              </div>
            </div>

            {/* Textarea */}
            <textarea
              className="w-full min-h-[140px] p-3.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 bg-background text-foreground text-xs sm:text-sm font-mono leading-relaxed resize-y shadow-2xs"
              placeholder={`Ví dụ:\nIT001.O11.1, IT002.O12.2, IT003.O13.1\n\nHoặc mỗi mã lớp trên một dòng riêng...`}
              value={classCodesText}
              onChange={(e) => {
                setClassCodesText(e.target.value);
                if (errors.length > 0) setErrors([]);
              }}
            />

            {/* Helpful format guide */}
            <div className="p-3 rounded-xl bg-muted/30 border text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Info className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Quy tắc nhập dữ liệu:</span>
              </div>
              <p className="leading-relaxed pl-5">
                Các mã lớp có thể ngăn cách bằng <b>dấu phẩy</b>, <b>dấu chấm phẩy</b>, <b>khoảng trắng</b> hoặc <b>xuống dòng</b>. Hệ thống sẽ tự động lọc và ghép nối vào lịch.
              </p>
            </div>

            {/* Errors List if any */}
            {errors.length > 0 && (
              <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/20 p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-red-900 dark:text-red-300 font-bold text-xs">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                  <span>Phát hiện {errors.length} vấn đề khi xếp lớp:</span>
                </div>
                <ul className="space-y-1 pl-6 text-xs text-red-700 dark:text-red-300">
                  {errors.map((err, i) => (
                    <li key={i} className="list-disc leading-tight">
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t bg-muted/20 flex items-center justify-end gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            className="text-xs"
          >
            Đóng
          </Button>

          <Button
            size="sm"
            onClick={handleConfirmImport}
            disabled={parsedCodes.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
          >
            Xác nhận xếp {parsedCodes.length > 0 ? `${parsedCodes.length} lớp` : "lớp"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ImportClassCodesModal;
