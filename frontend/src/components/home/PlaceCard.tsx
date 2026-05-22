import Image from 'next/image';

interface PlaceCardProps {
  title: string;
  category: string;
  categoryType: 'primary' | 'secondary' | 'tertiary';
  description: string;
  imageUrl: string;
  isRecommended?: boolean;
  amenities: { icon: string; title: string }[];
  layout?: 'vertical' | 'horizontal';
  onClick?: () => void;
}

export default function PlaceCard({
  title, category, categoryType, description, imageUrl, isRecommended, amenities, layout = 'horizontal', onClick
}: PlaceCardProps) {
  
  const categoryStyles = {
    primary: 'text-primary bg-primary-container/30',
    secondary: 'text-secondary bg-secondary-container/30',
    tertiary: 'text-tertiary bg-tertiary-container/30'
  };

  if (layout === 'vertical') {
    return (
      <div onClick={onClick} className="bg-surface-container-lowest rounded-[24px] shadow-md overflow-hidden border border-surface-container-high hover:shadow-lg transition-all active:scale-[0.99] cursor-pointer group">
        <div className="relative h-48 w-full">
          <img src={imageUrl} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          {isRecommended && (
            <div className="absolute top-4 left-4 bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full font-label-sm text-label-sm flex items-center gap-1 shadow-sm">
              <span className="material-symbols-outlined text-[14px]">star</span> 추천
            </div>
          )}
          <button className="absolute top-4 right-4 w-8 h-8 bg-surface/80 backdrop-blur-sm rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-[20px]">favorite_border</span>
          </button>
        </div>
        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-headline-md text-headline-md text-on-surface">{title}</h3>
            <span className={`font-label-sm text-label-sm px-2 py-0.5 rounded ${categoryStyles[categoryType]}`}>{category}</span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2 mb-4">{description}</p>
          <div className="flex gap-3 border-t border-surface-container-high pt-3">
            {amenities.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1 text-tertiary tooltip-trigger" title={item.title}>
                <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div onClick={onClick} className="bg-surface-container-lowest rounded-[24px] shadow-sm overflow-hidden border border-surface-container-high hover:shadow-md transition-all active:scale-[0.99] cursor-pointer group flex">
      <div className="w-1/3 relative">
        <img src={imageUrl} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      </div>
      <div className="p-4 w-2/3 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-1">
            <h3 className="font-label-lg text-label-lg text-on-surface font-bold">{title}</h3>
            <span className={`font-label-sm text-label-sm px-2 py-0.5 rounded ${categoryStyles[categoryType]}`}>{category}</span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant text-sm line-clamp-2">{description}</p>
        </div>
        <div className="flex gap-3 mt-3 text-outline">
          {amenities.map((item, idx) => (
            <span key={idx} className="material-symbols-outlined text-[16px] tooltip-trigger" title={item.title}>{item.icon}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
