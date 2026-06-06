import { format } from "date-fns";

export function downloadCsv(headers: string[], rows: any[][], filenamePrefix: string) {
    if (rows.length === 0) return;

    const csvRows = [headers.join(",")];

    rows.forEach(row => {
        const escapedRow = row.map(cell => {
            if (cell === null || cell === undefined) return '""';
            const s = String(cell).replace(/"/g, '""');
            return `"${s}"`;
        });
        csvRows.push(escapedRow.join(","));
    });

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filenamePrefix}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
