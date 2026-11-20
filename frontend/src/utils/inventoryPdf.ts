import { jsPDF } from 'jspdf';
import { ProductDto } from '../types';
import { getImageUrl } from '../services/api';
import { formatCurrency } from './format';

export type InventoryPriceType = 'retail' | 'wholesale';

const loadThumbnail = async (imageUrl: string): Promise<string | undefined> => {
  let objectUrl = '';
  try {
    const response = await fetch(getImageUrl(imageUrl));
    if (!response.ok) return undefined;

    objectUrl = URL.createObjectURL(await response.blob());
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to load product image'));
      image.src = objectUrl;
    });

    const scale = Math.min(96 / image.naturalWidth, 96 / image.naturalHeight, 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) return undefined;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.65);
  } catch {
    return undefined;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
};

export const generateInventoryPdf = async (products: ProductDto[], priceType: InventoryPriceType): Promise<void> => {
  const document = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 14;
  const columns = [36, 20, 86, 40];
  const contentWidth = columns.reduce((total, width) => total + width, 0);
  const priceHeading = priceType === 'retail' ? 'Price (Retail)' : 'Price (Wholesale)';
  let y = 0;

  const drawPageHeading = () => {
    document.setFont('helvetica', 'bold');
    document.setFontSize(15);
    document.setTextColor(30, 41, 59);
    document.text('INVENTORY PRODUCT LIST', margin, 18);
    document.setFont('helvetica', 'normal');
    document.setFontSize(9);
    document.setTextColor(100, 116, 139);
    document.text(`${priceType === 'retail' ? 'Retail' : 'Wholesale'} pricing | ${products.length} products`, margin, 24);

    y = 31;
    document.setFillColor(241, 245, 249);
    document.rect(margin, y, contentWidth, 9, 'F');
    document.setFont('helvetica', 'bold');
    document.setFontSize(8.5);
    document.setTextColor(30, 41, 59);
    const headings = ['Code', 'Image', 'Product Name', priceHeading];
    let x = margin;
    headings.forEach((heading, index) => {
      document.text(heading, x + 2, y + 6);
      x += columns[index];
    });
    y += 9;
  };

  drawPageHeading();
  document.setFont('helvetica', 'normal');
  document.setFontSize(8.5);
  document.setTextColor(51, 65, 85);

  for (const product of products) {
    const nameLines = document.splitTextToSize(product.name || '', columns[2] - 4) as string[];
    const rowHeight = Math.max(18, nameLines.length * 4 + 6);
    if (y + rowHeight > pageHeight - margin) {
      document.addPage();
      drawPageHeading();
      document.setFont('helvetica', 'normal');
      document.setFontSize(8.5);
      document.setTextColor(51, 65, 85);
    }

    const imageData = product.imageUrl ? await loadThumbnail(product.imageUrl) : undefined;
    const cellValues = [product.itemCode || '', '', product.name || '', formatCurrency(
      priceType === 'retail' ? product.standardPrice : product.wholesalePrice
    )];
    let x = margin;
    columns.forEach((width, index) => {
      document.setDrawColor(226, 232, 240);
      document.rect(x, y, width, rowHeight);
      if (index !== 1 && index !== 2) {
        document.text(cellValues[index], x + 2, y + rowHeight / 2 + 1, { maxWidth: width - 4 });
      }
      if (index === 2) {
        document.text(nameLines, x + 2, y + 5, { maxWidth: width - 4 });
      }
      if (index === 1 && imageData) {
        const dimensions = document.getImageProperties(imageData);
        const imageScale = Math.min(14 / dimensions.width, 14 / dimensions.height);
        const imageWidth = dimensions.width * imageScale;
        const imageHeight = dimensions.height * imageScale;
        document.addImage(imageData, 'JPEG', x + (width - imageWidth) / 2, y + (rowHeight - imageHeight) / 2, imageWidth, imageHeight);
      }
      x += width;
    });
    y += rowHeight;
  }

  const pageCount = document.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    document.setPage(page);
    document.setFontSize(8);
    document.setTextColor(100, 116, 139);
    document.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  const date = new Date().toISOString().slice(0, 10);
  document.save(`inventory-${priceType}-${date}.pdf`);
};