import { useEffect, useState, useCallback, useRef } from 'react';

// Определение возможных зон навигации на экране Google TV
export type TVZone = 'sidebar' | 'banner' | 'grid' | 'player';

interface UseTVNavigationProps {
  gridCols: number;         // Количество колонок в сетке аниме
  gridTotalItems: number;   // Всего элементов в сетке аниме
  sidebarTotalItems: number;// Количество элементов в боковом меню
  bannerTotalItems: number; // Количество активных кнопок/элементов в баннере
  onEnterPress?: (zone: TVZone, index: number) => void; // Колбэк нажатия Enter/ОК
  onBackPress?: () => void;  // Колбэк нажатия Back/Назад (Escape/Backspace)
}

export function useTVNavigation({
  gridCols,
  gridTotalItems,
  sidebarTotalItems,
  bannerTotalItems,
  onEnterPress,
  onBackPress,
}: UseTVNavigationProps) {
  // Активная зона по умолчанию - сетка ('grid') или баннер. Начнем с 'grid'
  const [activeZone, setActiveZone] = useState<TVZone>('grid');

  // Храним индексы активных элементов для каждой зоны отдельно.
  // Это важнейшее поведение для Smart TV: при переходе из меню назад в сетку,
  // фокус должен возвращаться на ту же карточку, где пользователь и находился.
  const [activeIndexes, setActiveIndexes] = useState<Record<TVZone, number>>({
    sidebar: 0,
    banner: 0,
    grid: 0,
    player: 0,
  });

  // Реестр DOM-элементов для автоматического скролла
  const elementRefs = useRef<Record<string, HTMLElement | null>>({});

  // Функция для регистрации Ref элемента в реестре
  const setRef = useCallback((zone: TVZone, index: number, el: HTMLElement | null) => {
    const key = `${zone}-${index}`;
    if (el) {
      elementRefs.current[key] = el;
    } else {
      delete elementRefs.current[key];
    }
  }, []);

  // Функция автоматического плавного скролла к активному элементу
  const smoothScrollToActive = useCallback((zone: TVZone, index: number) => {
    const key = `${zone}-${index}`;
    const element = elementRefs.current[key];
    if (element) {
      // Скроллим элемент в центр экрана, чтобы он всегда оставался видимым
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    }
  }, []);

  // Безопасное обновление индекса в текущей зоне
  const updateIndex = useCallback((zone: TVZone, newIndex: number) => {
    setActiveIndexes((prev) => {
      const updated = { ...prev, [zone]: newIndex };
      // Запускаем плавный скроллинг к свежему элементу
      setTimeout(() => smoothScrollToActive(zone, newIndex), 10);
      return updated;
    });
  }, [smoothScrollToActive]);

  // Функция принудительной установки фокуса (например, при наведении мыши в браузере)
  const focusElement = useCallback((zone: TVZone, index: number) => {
    setActiveZone(zone);
    updateIndex(zone, index);
  }, [updateIndex]);

  // Обработчик нажатий клавиш D-pad
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const key = event.key;
    const currentIndex = activeIndexes[activeZone];

    switch (key) {
      case 'ArrowUp':
        event.preventDefault();
        if (activeZone === 'grid') {
          // Если мы в сетке и нажимаем ВВЕРХ
          if (currentIndex - gridCols >= 0) {
            // Движение внутри сетки вверх на одну строку
            updateIndex('grid', currentIndex - gridCols);
          } else if (bannerTotalItems > 0) {
            // Если выходим за верхнюю границу сетки, переходим на баннер (Spotlight)
            setActiveZone('banner');
            updateIndex('banner', 0);
          }
        } else if (activeZone === 'sidebar') {
          // Движение по боковому меню вверх
          if (currentIndex > 0) {
            updateIndex('sidebar', currentIndex - 1);
          }
        } else if (activeZone === 'banner') {
          // Если в баннере нажать вверх - ничего не происходит или фокус остается
        }
        break;

      case 'ArrowDown':
        event.preventDefault();
        if (activeZone === 'grid') {
          // Движение внутри сетки вниз на одну строку
          if (currentIndex + gridCols < gridTotalItems) {
            updateIndex('grid', currentIndex + gridCols);
          }
        } else if (activeZone === 'banner') {
          // С баннера переходим вниз в сетку аниме
          if (gridTotalItems > 0) {
            setActiveZone('grid');
            updateIndex('grid', 0);
          }
        } else if (activeZone === 'sidebar') {
          // Движение по боковому меню вниз
          if (currentIndex < sidebarTotalItems - 1) {
            updateIndex('sidebar', currentIndex + 1);
          }
        }
        break;

      case 'ArrowLeft':
        event.preventDefault();
        if (activeZone === 'grid') {
          // Движение по сетке влево
          if (currentIndex % gridCols > 0) {
            updateIndex('grid', currentIndex - 1);
          } else {
            // Если мы у крайней левой границы сетки, переходим в левый Sidebar
            setActiveZone('sidebar');
            // Индекс в сайдбаре сохраняется предыдущий!
            setTimeout(() => smoothScrollToActive('sidebar', activeIndexes.sidebar), 10);
          }
        } else if (activeZone === 'banner') {
          // С баннера переходим влево в Sidebar
          setActiveZone('sidebar');
          setTimeout(() => smoothScrollToActive('sidebar', activeIndexes.sidebar), 10);
        }
        break;

      case 'ArrowRight':
        event.preventDefault();
        if (activeZone === 'sidebar') {
          // Из сайдбара шагаем вправо
          // Сначала пробуем вернуться на баннер или в сетку
          if (activeIndexes.banner !== undefined && bannerTotalItems > 0) {
            setActiveZone('banner');
            setTimeout(() => smoothScrollToActive('banner', activeIndexes.banner), 10);
          } else if (gridTotalItems > 0) {
            setActiveZone('grid');
            setTimeout(() => smoothScrollToActive('grid', activeIndexes.grid), 10);
          }
        } else if (activeZone === 'grid') {
          // Движение по сетке вправо
          if (currentIndex % gridCols < gridCols - 1 && currentIndex + 1 < gridTotalItems) {
            updateIndex('grid', currentIndex + 1);
          }
        }
        break;

      case 'Enter':
        event.preventDefault();
        if (onEnterPress) {
          onEnterPress(activeZone, currentIndex);
        }
        break;

      case 'Escape':
      case 'Backspace':
        // Назад на пульте (Escape или Backspace на клавиатуре)
        event.preventDefault();
        if (onBackPress) {
          onBackPress();
        }
        break;

      default:
        break;
    }
  }, [
    activeZone,
    activeIndexes,
    gridCols,
    gridTotalItems,
    sidebarTotalItems,
    bannerTotalItems,
    updateIndex,
    smoothScrollToActive,
    onEnterPress,
    onBackPress,
  ]);

  // Слушаем события клавиатуры глобально
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return {
    activeZone,
    activeIndexes,
    setActiveZone,
    setActiveItem: focusElement,
    registerRef: setRef,
    smoothScrollToActive,
  };
}
