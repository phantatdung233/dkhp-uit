/**
 * Hook quản lý các thao tác tương tác với thời khóa biểu (xuất mã lớp, nhập mã lớp, xóa lịch, xuất ảnh PNG).
 */

import { useState } from "react";
import { toast } from "sonner";
import { toPng } from "html-to-image";

import { useScheduleStore } from "@/store/schedule-store";

export function useScheduleActions() {
  const { allSections, scheduledClasses, clearSchedule, addClassToSchedule } = useScheduleStore();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [forceFullCalendar, setForceFullCalendar] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importClassCodes, setImportClassCodes] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const hasSchedule = scheduledClasses.length > 0;

  /**
   * Sao chép danh sách các mã lớp đã đăng ký vào clipboard (ngăn cách bởi dấu phẩy).
   */
  const handleExportCoursesCodes = () => {
    const classCodes = scheduledClasses
      .map((sc) => sc.classSection.classCode)
      .sort()
      .join(",");

    if (!classCodes) {
      toast.error("Chưa có lớp nào để xuất");
      return;
    }

    navigator.clipboard.writeText(classCodes);
    toast.success(`Đã sao chép ${scheduledClasses.length} mã lớp`);
  };

  const handleImportCoursesCodes = () => {
    setImportClassCodes("");
    setImportErrors([]);
    setShowImportDialog(true);
  };

  /**
   * Xử lý nhập và xếp danh sách mã lớp học phần vào phương án hiện tại.
   */
  const handleConfirmImport = (codesOverride?: string): string[] => {
    const rawText = codesOverride !== undefined ? codesOverride : importClassCodes;
    if (!rawText.trim()) {
      toast.error("Vui lòng nhập mã lớp");
      return ["Vui lòng nhập danh sách mã lớp"];
    }

    const codes = rawText
      .split(/[\n,;\s]+/)
      .map((code) => code.trim())
      .filter((code) => code.length > 0);

    if (codes.length === 0) {
      toast.error("Không có mã lớp hợp lệ");
      return ["Không có mã lớp hợp lệ"];
    }

    const errors: string[] = [];
    const addedClasses: string[] = [];
    const skippedClasses: string[] = [];

    codes.forEach((code) => {
      const section = allSections.find((s) => s.classCode === code);

      if (!section) {
        errors.push(`Không tìm thấy lớp "${code}"`);
        return;
      }

      const alreadyRegistered = scheduledClasses.some((sc) => sc.classSection.classCode === code);
      if (alreadyRegistered) {
        skippedClasses.push(code);
        return;
      }

      // Kiểm tra lớp thực hành bắt buộc đi kèm lớp lý thuyết
      if (!section.isPractical) {
        const practicalSections = allSections.filter(
          (s) => s.courseCode === section.courseCode && s.isPractical && s.classCode.startsWith(section.classCode + ".")
        );

        if (practicalSections.length > 0) {
          const hasPracticalInInput = practicalSections.some((ps) => codes.includes(ps.classCode));

          if (!hasPracticalInInput) {
            errors.push(`Lớp "${code}": Cần nhập thêm lớp thực hành (VD: ${practicalSections[0].classCode})`);
            return;
          }
        }
      }

      const result = addClassToSchedule(section, true);

      if (result.success) {
        addedClasses.push(code);
      } else {
        if (result.conflicts && result.conflicts.length > 0) {
          errors.push(`Lớp "${code}": Trùng lịch với ${result.conflicts[0].conflictingClasses[0].classCode}`);
        } else if (result.error) {
          errors.push(`Lớp "${code}": ${result.error}`);
        }
      }
    });

    if (addedClasses.length > 0) {
      toast.success(`Đã thêm ${addedClasses.length} lớp vào lịch`);
    }

    if (skippedClasses.length > 0) {
      toast.info(`Bỏ qua ${skippedClasses.length} lớp đã đăng ký`);
    }

    if (errors.length > 0) {
      setImportErrors(errors);
      return errors;
    }

    setShowImportDialog(false);
    setImportClassCodes("");
    setImportErrors([]);
    return [];
  };

  const handleClearSchedule = () => {
    clearSchedule();
    setShowClearConfirm(false);
    toast.success("Đã xóa lịch đã xếp");
  };

  /**
   * Chụp ảnh lưới thời khóa biểu và tải về file PNG hoặc sao chép vào clipboard.
   */
  const handleExportImage = async (action: "download" | "copy") => {
    setForceFullCalendar(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const node = document.getElementById("schedule-calendar");
    if (!node) {
      setForceFullCalendar(false);
      toast.error("Không tìm thấy lịch để xuất ảnh");
      return;
    }

    try {
      toast.loading(action === "download" ? "Đang tạo ảnh..." : "Đang sao chép...", { id: "export-image" });
      await new Promise((resolve) => setTimeout(resolve, 500));

      const dataUrl = await toPng(node, {
        backgroundColor: "#ffffff",
        quality: 1,
        pixelRatio: 2,
        style: {
          overflow: "visible",
        },
      });

      if (action === "download") {
        const link = document.createElement("a");
        link.download = `TKB-UIT-${new Date().toISOString().split("T")[0]}.png`;
        link.href = dataUrl;
        link.click();
        toast.success("Đã tải ảnh thời khóa biểu", { id: "export-image" });
      } else {
        const blob = await (await fetch(dataUrl)).blob();
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob,
          }),
        ]);
        toast.success("Đã sao chép ảnh vào clipboard", { id: "export-image" });
      }
    } catch (error) {
      console.error("Export error:", error);
      if (action === "copy") {
        toast.error("Lỗi khi sao chép ảnh. Trình duyệt có thể không hỗ trợ.", { id: "export-image" });
      } else {
        toast.error("Lỗi khi xuất ảnh", { id: "export-image" });
      }
    } finally {
      setForceFullCalendar(false);
    }
  };

  return {
    showClearConfirm,
    setShowClearConfirm,
    forceFullCalendar,
    showImportDialog,
    setShowImportDialog,
    importClassCodes,
    setImportClassCodes,
    importErrors,
    setImportErrors,
    hasSchedule,

    handleExportCoursesCodes,
    handleImportCoursesCodes,
    handleConfirmImport,
    handleClearSchedule,
    handleExportImage,
  };
}

