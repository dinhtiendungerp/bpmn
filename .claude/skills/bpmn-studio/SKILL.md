---
name: bpmn-studio
description: Vẽ lưu đồ quy trình BPMN 2.0 và xuất file HTML tương tác độc lập bằng repo dinhtiendungerp/bpmn. Viết quy trình bằng DSL văn bản, script tự tính bố cục và trả về danh sách câu hỏi khảo sát còn bỏ ngỏ. Dùng khi cần vẽ quy trình nghiệp vụ, process flow, lưu đồ phê duyệt, sơ đồ BPMN, swimlane, diagram quy trình để gửi khách hàng, hoặc rà một quy trình vừa khảo sát xem còn thiếu gì.
---

# BPMN Studio

Tạo diagram BPMN 2.0 tương tác từ mô tả nghiệp vụ. Kết quả là một file HTML độc lập (~2 MB) chứa sẵn viewer, chạy offline, mở bằng trình duyệt bất kỳ, có Story, PATH, Journey, MAP, LENS, tìm kiếm và chế độ trình chiếu. File `.bpmn` đi kèm mở được bằng Camunda Modeler và bpmn.io.

Không dùng skill này cho flowchart đơn giản (dùng Mermaid), sơ đồ kiến trúc hệ thống, hay ERD.

## Chuẩn bị (một lần mỗi phiên)

Yêu cầu Node.js 22.13+.

```bash
# Dùng lại bản clone nếu đã có, không clone lại
ls bpmn-studio/scripts/dsl-to-bpmn.mjs 2>/dev/null || git clone --depth 1 https://github.com/dinhtiendungerp/bpmn.git bpmn-studio
cd bpmn-studio && npm ci
```

`npm ci` mất khoảng 25 giây đến 2 phút. Chỉ chạy một lần mỗi phiên.

## Quy trình làm việc

Mặc định viết DSL, không viết XML tay. DSL tự tính toạ độ, tự đặt nhãn và tự sinh condition, default, incoming, outgoing, nên phần lớn lỗi validate không còn cơ hội xảy ra. Cú pháp đầy đủ ở `docs/DSL.md`, đọc file đó trước lần viết đầu tiên trong phiên.

### 1. Gom dữ kiện trước khi viết

Từ tài liệu khảo sát, biên bản họp hoặc mô tả của người dùng, liệt kê:

1. Điều gì kích hoạt quy trình, và mọi kết thúc có thể có (không chỉ kết thúc tốt).
2. Các vai trò hoặc hệ thống thực hiện bước. Đây là danh sách lane.
3. Các bước theo thứ tự, mỗi bước gắn một vai trò.
4. Các quyết định, mỗi quyết định có câu hỏi và mọi kết quả.
5. Chỗ chuyển giao giữa hai vai trò: cái gì được chuyển (chứng từ, hàng, thông tin).
6. Luồng làm lại: cái gì bị trả về, trả cho ai, vì sao.
7. Việc chạy song song, và chỗ chúng gặp lại nhau.
8. Bên ngoài (nhà cung cấp, khách hàng, ngân hàng) và thông điệp trao đổi với họ.

Không bịa bước. Nguồn chỉ nói "rồi duyệt" mà không nói bị từ chối thì sao, thì đó là một câu hỏi, không phải chỗ để tự điền. Cứ viết DSL với những gì có, script sẽ liệt kê các chỗ còn hở ở bước 3.

### 2. Viết DSL

Ghi vào `work/<tên>.flow`. Mẫu ngắn:

```
title "Duyệt đề nghị mua hàng"
lane yc  "Người yêu cầu"
lane duy "Trưởng bộ phận"

yc:  s     start "Phát sinh nhu cầu"
yc:  lap         "Lập đề nghị mua" "Ghi mặt hàng, số lượng, ngày cần."
duy: xet         "Xem xét đề nghị"
duy: ok    ?     "Duyệt?"
yc:  sua         "Sửa đề nghị"
duy: xong  end   "Đã duyệt"

s > lap > xet "đề nghị mua"
xet > ok
ok > xong "duyệt"
ok > sua "trả lại"
sua ~> xet "đề nghị đã sửa"
```

Những điểm hay quên:

- Mọi bước trong pool có lane phải có tiền tố `<lane>:`.
- Nhánh ra từ cổng `?` phải có nhãn. Nhãn luồng chuyển giữa hai lane ghi cái được chuyển giao ("đề nghị mua"), không ghi "tiếp theo".
- Luồng quay lại bước trước viết `~>` để bố cục không kéo các bước sau sang phải.
- Đặt mô tả (chuỗi thứ hai trên dòng bước, hoặc dòng `doc`) cho mọi bước có ý nghĩa nghiệp vụ. Nội dung này hiện trong Passport khi người xem nhấp vào bước, là giá trị chính của diagram tương tác.
- Bên ngoài như nhà cung cấp khai `pool ncc "Nhà cung cấp"` ở cuối phần khai báo lane, rồi nối bằng `po => ncc "Đơn mua hàng"`.

### 3. Dịch, đọc finding, sửa, lặp lại

```bash
node scripts/dsl-to-bpmn.mjs work/<tên>.flow work/<tên>.bpmn --questions work/<tên>-cau-hoi.md
```

- LỖI: file `.bpmn` chưa được ghi. Sửa DSL rồi chạy lại.
- CẦN HỎI LẠI: chỗ quy trình còn bỏ ngỏ. Nếu nguồn có câu trả lời thì sửa DSL. Nếu không có thì giữ nguyên, và đưa các câu này cho người dùng làm danh sách câu hỏi khảo sát (file `--questions`). Không tự bịa câu trả lời để hết cảnh báo.
- GỢI Ý: đọc qua. `auto-default` cho biết nhánh nào đã được lấy làm nhánh mặc định, kiểm xem đúng chưa.

### 4. Kiểm ngữ nghĩa và hình học

```bash
node scripts/validate-bpmn.mjs work/<tên>.bpmn
node scripts/check-layout.mjs work/<tên>.bpmn
```

Cả hai phải ra `"issues": []`. File sinh từ DSL thường sạch ngay. Nếu `check-layout` còn báo thì thường do tên quá dài hoặc quá nhiều nhánh dồn vào một bước: rút ngắn tên, dùng `|` để xuống dòng, hoặc tách bớt nhánh.

### 5. Render và giao

```bash
node scripts/render-bpmn.mjs work/<tên>.bpmn output/<tên>.html "Tên quy trình"
```

Giao file HTML cho người dùng bằng SendUserFile, kèm file câu hỏi nếu còn câu hỏi mở. Nếu có folder đã kết nối thì ghi kèm file `.flow` và `.bpmn` vào đó, để lần sau sửa tiếp trên `.flow`.

## Khi DSL không đủ

DSL chưa hỗ trợ: sub-process mở rộng có bước con bên trong, data object, data store, text annotation, group, lane dọc, và lane lồng nhau. Có hai cách:

- Sinh phần khung bằng DSL, rồi mở file `.bpmn` trong editor (`npm run dev`, vào `/?edit=1`) hoặc Camunda Modeler để thêm phần còn thiếu.
- Viết XML tay theo khuôn trong `examples/bpmn/` (đọc `timer.bpmn` cho Boundary Timer, `collaboration.bpmn` cho hai pool và Message Flow). Sau đó vẫn chạy đủ bước 4 và 5.

Checklist khi viết XML tay, cũng là những thứ DSL đang tự làm:

- Mỗi process có ít nhất một Start Event và một End Event. Start không có flow vào, End không có flow ra.
- Exclusive/Inclusive Gateway nhiều nhánh ra: khai `default="<id flow>"`, mọi nhánh không phải default có `conditionExpression`, mọi nhánh có `name`. Nhánh default không có condition.
- Parallel Gateway không có condition trên nhánh ra.
- Boundary Event có `attachedToRef`, không có flow vào. Timer có `timeDuration`, `timeDate` hoặc `timeCycle`.
- Nối hai pool dùng Message Flow. Mỗi node nằm ở đúng một `flowNodeRef` trong `laneSet`.
- Xuống dòng trong thuộc tính `name` viết `&#10;`, không viết ký tự xuống dòng thật (bị đổi thành dấu cách).

Màu (thuộc tính `bioc:fill` / `bioc:stroke` trên BPMNShape):

| Phần tử | fill | stroke |
|---|---|---|
| Start / Intermediate / Boundary Event | `#e4f5ee` | `#298273` |
| End Event | `#fff0f0` | `#b95560` |
| Gateway | `#fff8e6` | `#b3812f` |
| Task các loại | `#eef4ff` | `#5c81c2` |
| Pool | `#ffffff` | `#9aaac1` |
| Lane chẵn / lẻ | `#ffffff` / `#f6f9fd` | `#c6d1df` |
| BPMNEdge | | `#7e90aa` |

## Giới hạn

- Không hỗ trợ `<!DOCTYPE>` hay `<!ENTITY>`, bị chặn ngay từ bước đọc file.
- Chỉ Process và Collaboration. Không hỗ trợ Choreography, Conversation.
- Story và PATH chỉ phân tích đồ thị kết nối, không thực thi condition hay mô phỏng token. Đừng mô tả với người dùng là diagram "chạy được nghiệp vụ".
- Finding của DSL chỉ đếm cấu trúc. Nó không biết các bước có đúng với thực tế không, cũng không biết một cổng đã đủ mọi trường hợp chưa.
- Chỉnh tay file `.bpmn` sau khi sinh thì file `.flow` không nhận lại chỉnh sửa đó. Chỉnh tay là bước cuối cùng.

## Lệnh phụ

```bash
npm run bpmn:dsl -- work/<tên>.flow          # như bước 3
npm run bpmn:examples                        # dựng lại các mẫu trong examples/bpmn và public/diagrams
npm run bpmn:layout -- examples/bpmn/*.bpmn  # kiểm hình học cả bộ mẫu
npm run test:bpmn                            # test XML round-trip, condition, BPMNDI và DSL
```

Mẫu DSL đủ cấu trúc (song song, boundary timer, pool nhà cung cấp, đánh số bước): `examples/dsl/mua-hang-nhap-kho.flow`.

## Lưu ý bản quyền

Bản repo này đã ẩn watermark bpmn.io. Điều đó trái với license của bpmn-js (`public/vendor/BPMN-JS-LICENSE.txt`). Khi người dùng định phát hành công khai hoặc dùng thương mại, nhắc một câu về việc cân nhắc mua commercial license từ Camunda. Nhắc một lần, không lặp lại mỗi diagram.
