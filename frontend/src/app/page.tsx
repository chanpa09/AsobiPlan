"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import SearchBar from "@/components/home/SearchBar";
import PlaceCard from "@/components/home/PlaceCard";

const Map = dynamic(() => import("../components/Map"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full bg-surface-container-lowest">
      <h2 className="text-primary font-headline-md">지도 로드 중...</h2>
    </div>
  ),
});

export default function Home() {
  const [mapCenter, setMapCenter] = useState<[number, number]>([35.6620, 139.8100]);
  const [activeSpotId, setActiveSpotId] = useState<string | null>(null);

  const recommendedPlaces = [
    {
      id: "place-1",
      coordinates: [35.6548, 139.7967],
      title: "라라포트 도요스",
      category: "쇼핑몰",
      categoryType: "primary" as const,
      description: "넓은 통로와 훌륭한 수유 시설을 갖춘 대형 쇼핑몰. 아이들을 위한 실내 놀이터와 키즈 프렌들리 레스토랑이 다수 입점해 있습니다.",
      imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuCR8HnbR71FzqquH07OSTM2O6mpsCZz2UqfFYLRU2sqOrq-xOL2fEhqsHYrclDa1lulTxMFCQGmZI5k8WxN5QOOX2OVZpa4SFOYCYjtBMdwOKkC4BCziim2raZqkO7-sxesJjj46BDky51OGIsi7CE0xCtZdWMFL6LzBREAZ83viP_7OlwZUBJg4wcH3C0VII3B_u7FBO1uPzGpZKPyIkhTCR1250WTLS3Fggbo3knA7oQlMhGopQ_fANeasACkTYROwwfXLQJyfKg",
      isRecommended: true,
      layout: "vertical" as const,
      amenities: [
        { icon: "stroller", title: "유모차 대여 가능" },
        { icon: "baby_changing_station", title: "수유실" },
        { icon: "restaurant", title: "키즈 메뉴" }
      ]
    },
    {
      id: "place-2",
      coordinates: [35.6749, 139.8079],
      title: "기바 공원",
      category: "공원",
      categoryType: "tertiary" as const,
      description: "넓은 잔디밭과 현대미술관이 인접해 있어 가족 피크닉에 최적의 장소입니다.",
      imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuCfcxwxvLWZqISuS0qZ74QwkRUN-u8Cz2lyJCGJZlePCcOy3rkzQtuPrlQ_keK9i3hH91IXpqLoh3W2NZqZBLKWWVNr6shpZ-W046vQmLdTkdI4HbVz4QWeus2rWmHo3qwMUlnTKDWWzwXAS90w4sffZBEym9X7ju8_xI-Lfh1PR5_fhkxhVdwSg4OdKFx68YKJmt_KgbU-k9bPoatGPACCNCNMzqY6hEJl5eTMY-b7bEsNArul64G4-KAauwVAsHWgbxx400MzRco",
      layout: "horizontal" as const,
      amenities: [
        { icon: "park", title: "공원" },
        { icon: "accessible_forward", title: "유모차 접근 용이" }
      ]
    },
    {
      id: "place-8",
      coordinates: [35.6545, 139.7962],
      title: "100 스푼즈 도요스",
      category: "식당",
      categoryType: "secondary" as const,
      description: "아이들을 위한 세심한 배려가 돋보이는 레스토랑. 이유식 무료 제공 서비스가 있습니다.",
      imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuA6Udne2zTA45NA8jRIK3-859DiVEVU6SZy0mCVeArVGYJiQTsMSKW3nHVA2lN_VN7tP5fPjfY2UUBKZSAt0aPyXIN1wJf_DdOqV5NTZydMYorN1Txn1WyF9iVtCTxprmvd_3TcotQdyZVkItNaxRG3ru4ybLJg60KziIpll8oietrN82ga_OAaXwzwOdD-NTq8AjBUzSJBsN_sYYJ0sg_ivx-R4s-QKUna5OUse85-EzEse1gIFc88r3RLfw7ieTjz7W3TfW5uZYI",
      layout: "horizontal" as const,
      amenities: [
        { icon: "restaurant", title: "식당" },
        { icon: "child_care", title: "키즈 케어" }
      ]
    }
  ];

  return (
    <div className="flex-1 flex flex-col md:flex-row relative h-full w-full">
      <SearchBar />
      
      {/* Map Area */}
      <div className="w-full md:w-2/3 h-[50vh] md:h-full bg-surface-container-lowest relative z-0">
        <Map
          center={mapCenter}
          onCenterChange={setMapCenter}
          selectedSpotId={activeSpotId}
          onSpotSelect={setActiveSpotId}
        />
        {/* Floating Map Controls */}
        <div className="absolute bottom-margin-desktop right-margin-desktop flex flex-col gap-2 z-20 hidden md:flex pointer-events-auto">
          <button className="w-12 h-12 bg-surface shadow-md rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">my_location</span>
          </button>
          <div className="flex flex-col bg-surface shadow-md rounded-full overflow-hidden">
            <button className="w-12 h-12 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors border-b border-surface-container-high">
              <span className="material-symbols-outlined">add</span>
            </button>
            <button className="w-12 h-12 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors">
              <span className="material-symbols-outlined">remove</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Side Panel */}
      <div className="w-full md:w-1/3 h-[50vh] md:h-full bg-surface md:bg-surface/95 backdrop-blur-md shadow-[-4px_0_24px_rgba(0,0,0,0.05)] md:border-l border-outline-variant flex flex-col z-20">
        <div className="p-6 md:pt-32 border-b border-surface-container-high bg-surface sticky top-0 z-10">
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">추천 장소</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">현재 위치 주변의 가족 친화적인 장소들입니다.</p>
        </div>
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-stack-lg pb-24">
          {recommendedPlaces.map((place, index) => (
            <PlaceCard
              key={index}
              {...place}
              onClick={() => {
                if (place.coordinates) {
                  setMapCenter(place.coordinates as [number, number]);
                }
                if (place.id) {
                  setActiveSpotId(place.id);
                }
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
