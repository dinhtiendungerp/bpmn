---
name: bpmn-studio
description: Vẽ lưu đồ quy trình BPMN 2.0 và xuất file HTML tương tác độc lập bằng repo dinhtiendungerp/bpmn. Dùng khi cần vẽ quy trình nghiệp vụ, process flow, lưu đồ phê duyệt, sơ đồ BPMN, hoặc diagram quy trình để gửi khách hàng.
---

# BPMN Studio

Tạo diagram BPMN 2.0 tương tác từ mô tả nghiệp vụ. Kết quả là **một file HTML độc lập** (~2 MB) chứa sẵn viewer, chạy offline, mở bằng trình duyệt bất kỳ — có Story, PATH, Journey, MAP, LENS, tìm kiếm và chế độ trình chiếu.

Không dùng skill này cho flowchart đơn giản (dùng Mermaid), sơ đồ kiến trúc hệ thống, hay ERD.

## Chuẩn bị (một lần mỗi phiên)

Yêu cầu Node.js 22.13+.

```bash
# Dùng lại bản clone nếu đã có, không clone lại
ls bpmn-studio/scripts/render-bpmn.mjs 2>/dev/null || git clone --depth 1 https://github.com/dinhtiendungerp/bpmn.git bpmn-studio
cd bpmn-studio && npm ci
```

`npm ci` mất ~25 giây. Chỉ chạy một lần; các lần render sau trong cùng phiên bỏ qua bước này.

## Quy trình làm việc

Luôn theo đúng bốn bước, không bỏ bước nào. Hai bước kiểm soi hai thứ khác nhau và không thay thế nhau.

1. **Viết XML** vào `work/<tên>.bpmn` theo khuôn ở dưới.
2. **Kiểm ngữ nghĩa** — lặp đến khi sạch:
   ```bash
   node scripts/validate-bpmn.mjs work/<tên>.bpmn
   ```
   Chỉ đi tiếp khi kết quả là `"parseWarnings": []` và `"issues": []`. Mỗi issue đều có `id` trỏ đúng phần tử — sửa rồi chạy lại.
3. **Kiểm hình học** — cũng lặp đến khi `"issues": []`:
   ```bash
   node scripts/check-layout.mjs work/<tên>.bpmn
   ```
   Bước 2 không đọc một tọa độ nào, nên file "sạch" vẫn có thể render ra nhãn chồng nhãn hay node tràn lane. Bước này bắt đúng nhóm đó: nhãn đè nhãn, nhãn đè node, node chồng node, node hoặc nhãn tràn khỏi lane/pool, và đường nối xuyên qua node không phải đầu cuối của nó. Đừng tự nhẩm tọa độ bằng mắt — cứ chạy script.
4. **Render**:
   ```bash
   node scripts/render-bpmn.mjs work/<tên>.bpmn output/<tên>.html "Tên quy trình"
   ```

Giao file HTML cho người dùng bằng SendUserFile; nếu có folder đã kết nối thì ghi kèm vào đó.

## Khuôn XML

Giữ nguyên khối namespace này, chỉ đổi `id` và `targetNamespace` giữ nguyên:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0" id="P_definitions" targetNamespace="https://bpmn-studio.local/process" exporter="BPMN Studio" exporterVersion="1.0.0">
  <bpmn:collaboration id="P_collab"><bpmn:participant id="P_pool" name="Tên quy trình" processRef="P"/></bpmn:collaboration>
  <bpmn:process id="P" name="Tên quy trình" isExecutable="false">
    <bpmn:laneSet id="P_lanes">
      <bpmn:lane id="P_lane_0" name="Vai trò A"><bpmn:flowNodeRef>N1</bpmn:flowNodeRef></bpmn:lane>
    </bpmn:laneSet>
    <!-- node: startEvent, userTask, serviceTask, sendTask, exclusiveGateway, parallelGateway, boundaryEvent, endEvent -->
    <!-- mỗi node: <bpmn:documentation>, rồi <bpmn:incoming>, <bpmn:outgoing> -->
    <!-- sau tất cả node mới đến các <bpmn:sequenceFlow> -->
  </bpmn:process>
  <bpmndi:BPMNDiagram id="P_diagram"><bpmndi:BPMNPlane id="P_plane" bpmnElement="P_collab">
    <!-- BPMNShape cho pool, từng lane, từng node; rồi BPMNEdge cho từng flow -->
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>
```

`bpmnElement` của plane trỏ tới `P_collab` khi có pool/lane, trỏ tới `P` khi không có.

Đặt `<bpmn:documentation>` cho mọi node có ý nghĩa nghiệp vụ — nội dung này hiện trong Passport khi người xem nhấp vào node, là giá trị chính của diagram tương tác.

## Bố cục (BPMNDI)

Tọa độ phải tự tính, không có auto-layout. Đặt `LH` là chiều cao một lane rồi dùng bộ số này:

- **Chọn `LH` trước tiên.** `154` cho quy trình chạy thẳng, mỗi lane chỉ một hàng node. Tăng lên `200–220` khi có lane phải chứa nhiều thứ chồng nhau theo chiều dọc — hai End Event xếp trên dưới, hoặc gateway có nhãn nằm bên dưới. Nhãn cao 36 px nên `154` hết chỗ rất nhanh; thà lane rộng rãi còn hơn phải dịch nhãn thủ công.
- Pool: `x=70 y=90 width=W height=LH × số lane`. `W` khoảng 900–1200 cho quy trình ngắn, cứ nới rộng khi nhiều bước — diagram rộng vẫn hiển thị đúng tỉ lệ.
- Lane thứ `i`: `x=100 y=90+i*LH width=W-30 height=LH`
- Trục giữa lane `i`: `cy = 90 + i*LH + LH/2`
- Event **36×36** → `y = cy-18` · Task **126×74** → `y = cy-37` · Gateway **50×50** → `y = cy-25`
- Bước ngang giữa các node: 100–190 px
- Label của event và gateway (task không cần): `<bpmndi:BPMNLabel><dc:Bounds x="node.x + w/2 - 62" y="node.y + h + 9" width="124" height="36"/></bpmndi:BPMNLabel>`
- Waypoint: từ cạnh phải node nguồn `(x+w, cy)` đến cạnh trái node đích `(x, cy)`. Khi đổi lane, đi ba điểm: xuống rồi sang ngang.

Nhãn là chỗ hay đụng nhau nhất: nhãn gateway chiếm dải `y = cy+34` đến `cy+70`, nhãn event chiếm `y = cy+27` đến `cy+63`, cả hai rộng 124 px quanh tâm node. Ước lượng theo đó khi đặt, rồi để `check-layout.mjs` ở bước 3 nghiệm thu — nó chỉ đúng cặp nào đụng nhau. Cách gỡ: dịch nhãn sang ngang, hoặc tăng `LH`.

Màu (thuộc tính `bioc:fill` / `bioc:stroke` trên BPMNShape):

| Phần tử | fill | stroke |
|---|---|---|
| Start / Intermediate / Boundary Event | `#e4f5ee` | `#298273` |
| End Event | `#fff0f0` | `#b95560` |
| Gateway | `#fff8e6` | `#b3812f` |
| Task các loại | `#eef4ff` | `#5c81c2` |
| Pool | `#ffffff` | `#9aaac1` |
| Lane chẵn / lẻ | `#ffffff` / `#f6f9fd` | `#c6d1df` |
| BPMNEdge | — | `#7e90aa` |

## Checklist để validate sạch ngay lần đầu

Bộ validate chạy bpmnlint cộng các rule riêng. Những điểm hay sai:

- Mỗi process phải có **ít nhất một Start Event và một End Event**.
- Start Event không có flow đi vào; End Event không có flow đi ra.
- Mọi node khác đều phải có cả flow vào và flow ra.
- Activity phải có `name` đặt theo hành động nghiệp vụ.
- **Exclusive/Inclusive Gateway** có nhiều nhánh ra thì phải: khai `default="<id flow>"` trên gateway; mọi nhánh **không phải** default có `<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">`; **mọi** nhánh có thuộc tính `name`. Nhánh default thì có `name` nhưng **không** được có condition.
- **Parallel Gateway** không được có condition trên nhánh ra.
- **Boundary Event** phải có `attachedToRef` trỏ tới một Activity, và không có flow đi vào.
- **Timer** phải có `timeDuration`, `timeDate` hoặc `timeCycle` (ví dụ `PT24H`).
- **Sequence Flow** phải nằm trong cùng một process; nối hai pool khác nhau thì dùng **Message Flow**, và Message Flow bắt buộc nối hai participant khác nhau.
- Mọi node phải đi tới được từ một Start/Boundary Event, nếu không sẽ báo `unreachable`.
- Trong `laneSet`, mỗi node phải được liệt kê ở đúng một `<bpmn:flowNodeRef>`.

## Giới hạn

- Không hỗ trợ `<!DOCTYPE>` hay `<!ENTITY>` — bị chặn ngay từ bước đọc file.
- Chỉ Process và Collaboration. Không hỗ trợ Choreography, Conversation.
- Bắt buộc có khối BPMNDI; thiếu là render báo lỗi.
- Story và PATH chỉ phân tích đồ thị kết nối, **không** thực thi condition hay mô phỏng token. Đừng mô tả với người dùng là diagram "chạy được nghiệp vụ".

## Lệnh phụ

```bash
npm run bpmn:examples   # dựng lại 6 mẫu trong examples/bpmn và public/diagrams
npm run bpmn:layout -- examples/bpmn/*.bpmn   # kiểm hình học cả bộ mẫu
npm run test:bpmn       # bộ test XML round-trip, condition, BPMNDI
```

Sáu mẫu trong `examples/bpmn/` (purchasing, warehouse, approval, collaboration, timer, blank) là tài liệu tham khảo tốt nhất khi cần cấu trúc lạ — đọc `examples/bpmn/timer.bpmn` để xem Boundary Timer, `collaboration.bpmn` để xem hai pool và Message Flow.

## Lưu ý bản quyền

Bản repo này đã ẩn watermark bpmn.io. Điều đó trái với license của bpmn-js (`public/vendor/BPMN-JS-LICENSE.txt`). Khi người dùng định phát hành công khai hoặc dùng thương mại, nhắc một câu về việc cân nhắc mua commercial license từ Camunda — nhắc một lần, không lặp lại mỗi diagram.
