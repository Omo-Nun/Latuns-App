export function numberToWords(num: number): string {
    if (typeof num !== 'number' || Number.isNaN(num) || !Number.isFinite(num) || num <= 0) {
        return "Zero Naira Only";
    }

    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n: number): string => {
        if (Number.isNaN(n) || !Number.isFinite(n) || n < 0) return '';
        if (n < 20) return a[n] || '';
        if (n < 100) return (b[Math.floor(n / 10)] || '') + (n % 10 !== 0 ? ' ' + (a[n % 10] || '') : ' ');
        if (n < 1000) return (a[Math.floor(n / 100)] || '') + 'Hundred ' + (n % 100 !== 0 ? 'and ' + inWords(n % 100) : '');
        if (n < 1000000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 !== 0 ? inWords(n % 1000) : '');
        if (n < 1000000000) return inWords(Math.floor(n / 1000000)) + 'Million ' + (n % 1000000 !== 0 ? inWords(n % 1000000) : '');
        return inWords(Math.floor(n / 1000000000)) + 'Billion ' + (n % 1000000000 !== 0 ? inWords(n % 1000000000) : '');
    };

    const integerPart = Math.floor(num);
    const decimalPart = Math.round((num - integerPart) * 100);

    const intStr = inWords(integerPart);
    const decStr = decimalPart > 0 ? inWords(decimalPart) : '';

    let result = (intStr ? intStr.trim() : 'Zero') + " Naira";
    if (decStr) {
        result += " and " + decStr.trim() + " Kobo";
    }

    return result + " Only";
}
