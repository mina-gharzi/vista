const faNumber = new Intl.NumberFormat("fa-IR");

/** عدد با ارقام فارسی و جداکننده هزارگان: 1200000 → ۱٬۲۰۰٬۰۰۰ */
export function formatNumber(value: number): string {
  return faNumber.format(value);
}

/** قیمت به تومان (تمام مبالغ پروژه Int و تومان هستند). */
export function formatPrice(toman: number): string {
  return `${faNumber.format(toman)} تومان`;
}
