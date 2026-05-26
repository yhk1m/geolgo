-- 기존 데이터의 이름·전화번호에서 모든 공백 및 invisible 문자를 제거합니다.
-- Supabase SQL Editor에서 한 번만 실행하세요.
--
-- 대상 문자: 일반 공백, 탭, 개행, NBSP(U+00A0),
--          ZWSP(U+200B), ZWNJ(U+200C), ZWJ(U+200D), BOM(U+FEFF)

-- ====== 1단계: 영향받는 행 미리보기 ======

-- registrations.name
SELECT id, name AS old_name,
       regexp_replace(name, '[\s ​-‍﻿]+', '', 'g') AS new_name
FROM registrations
WHERE name ~ '[\s ​-‍﻿]';

-- registrations.phone
SELECT id, phone AS old_phone,
       regexp_replace(phone, '[\s ​-‍﻿]+', '', 'g') AS new_phone
FROM registrations
WHERE phone ~ '[\s ​-‍﻿]';

-- registrations.teacher_phone
SELECT id, teacher_phone AS old_teacher_phone,
       regexp_replace(teacher_phone, '[\s ​-‍﻿]+', '', 'g') AS new_teacher_phone
FROM registrations
WHERE teacher_phone ~ '[\s ​-‍﻿]';

-- groups.teacher_name, teacher_phone
SELECT id, teacher_name, teacher_phone FROM groups
WHERE teacher_name ~ '[\s ​-‍﻿]'
   OR teacher_phone ~ '[\s ​-‍﻿]';


-- ====== 2단계: 실제 정규화 적용 ======
-- 위 SELECT 결과 확인 후 아래 UPDATE를 실행하세요.

UPDATE registrations
SET name = regexp_replace(name, '[\s ​-‍﻿]+', '', 'g')
WHERE name ~ '[\s ​-‍﻿]';

UPDATE registrations
SET phone = regexp_replace(phone, '[\s ​-‍﻿]+', '', 'g')
WHERE phone ~ '[\s ​-‍﻿]';

UPDATE registrations
SET teacher_phone = regexp_replace(teacher_phone, '[\s ​-‍﻿]+', '', 'g')
WHERE teacher_phone ~ '[\s ​-‍﻿]';

UPDATE registrations
SET teacher_name = regexp_replace(teacher_name, '[\s ​-‍﻿]+', '', 'g')
WHERE teacher_name ~ '[\s ​-‍﻿]';

UPDATE groups
SET teacher_name = regexp_replace(teacher_name, '[\s ​-‍﻿]+', '', 'g')
WHERE teacher_name ~ '[\s ​-‍﻿]';

UPDATE groups
SET teacher_phone = regexp_replace(teacher_phone, '[\s ​-‍﻿]+', '', 'g')
WHERE teacher_phone ~ '[\s ​-‍﻿]';
