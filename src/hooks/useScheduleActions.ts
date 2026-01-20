/**
 * Schedule Actions Hook
 * ====================
 * Custom hook chứa các handler functions cho schedule operations
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

  const handleConfirmImport = () => {
    if (!importClassCodes.trim()) {
      toast.error("Vui lòng nhập mã lớp");
      return;
    }

    const codes = importClassCodes
      .split(",")
      .map((code) => code.trim())
      .filter((code) => code);

    if (codes.length === 0) {
      toast.error("Không có mã lớp hợp lệ");
      return;
    }

    const errors: string[] = [];
    const addedClasses: string[] = [];
    const skippedClasses: string[] = [];

    // Xử lý từng mã lớp
    codes.forEach((code) => {
      // Tìm class section từ mã lớp
      const section = allSections.find((s) => s.classCode === code);

      if (!section) {
        errors.push(`Không tìm thấy lớp "${code}"`);
        return;
      }

      // Kiểm tra đã đăng ký chưa
      const alreadyRegistered = scheduledClasses.some((sc) => sc.classSection.classCode === code);
      if (alreadyRegistered) {
        skippedClasses.push(code);
        return;
      }

      // Nếu là lớp lý thuyết, kiểm tra xem có lớp thực hành không
      if (!section.isPractical) {
        const practicalSections = allSections.filter(
          (s) => s.courseCode === section.courseCode && s.isPractical && s.classCode.startsWith(section.classCode + ".")
        );

        if (practicalSections.length > 0) {
          // Kiểm tra xem người dùng có nhập lớp TH nào không
          const hasPracticalInInput = practicalSections.some((ps) => codes.includes(ps.classCode));

          if (!hasPracticalInInput) {
            const practicalCodes = practicalSections.map((s) => s.classCode).join(", ");
            errors.push(`Lớp "${code}": Cần nhập thêm lớp thực hành (VD: ${practicalSections[0].classCode})`);
            return;
          }
        }
      }

      // Thêm vào lịch với kiểm tra conflict
      const result = addClassToSchedule(section, true); // skipPracticalPrompt = true

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

    // Hiển thị kết quả
    if (addedClasses.length > 0) {
      toast.success(`Đã thêm ${addedClasses.length} lớp vào lịch`);
    }

    if (skippedClasses.length > 0) {
      toast.info(`Bỏ qua ${skippedClasses.length} lớp đã đăng ký`);
    }

    if (errors.length > 0) {
      setImportErrors(errors);
      return; // Giữ dialog mở để hiển thị lỗi
    }

    setShowImportDialog(false);
    setImportClassCodes("");
    setImportErrors([]);
  };

  const handleClearSchedule = () => {
    clearSchedule();
    setShowClearConfirm(false);
    toast.success("Đã xóa lịch đã xếp");
  };

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
    // State
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

    // Handlers
    handleExportCoursesCodes,
    handleImportCoursesCodes,
    handleConfirmImport,
    handleClearSchedule,
    handleExportImage,
  };
}
