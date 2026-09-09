/** Curated tours shared by the app examples and the portable GitHub Pages build. */
export const chapters = {
 purchasing:[
  {id:'approved',label:'01 · Yêu cầu được duyệt',note:'Người yêu cầu → người phê duyệt → ERP. Theo nhánh approved = true.',focus:['Start_Request','Task_Request','Task_Review','Gateway_Approved','Task_PO','Task_Notify','End_Request']},
  {id:'revise',label:'02 · Bổ sung & gửi lại',note:'Nhánh mặc định trả yêu cầu để bổ sung. Đường nối quay lại đúng bước phê duyệt.',focus:['Task_Review','Gateway_Approved','Task_Revise']},
  {id:'erp',label:'03 · Tạo đơn trên ERP',note:'Các bước tích hợp sau khi được duyệt. Diagram không tự tạo đơn hay gửi email.',focus:['Gateway_Approved','Task_PO','Task_Notify','End_Request']}
 ],
 approval:[
  {id:'finance',label:'01 · Nhánh tài chính',note:'Một trong hai nhánh được kích hoạt bởi Parallel Gateway.',focus:['A_Start','A_Submit','A_Split','A_Finance','A_Join','A_Record','A_End']},
  {id:'manager',label:'02 · Nhánh quản lý',note:'Nhánh chạy song song. BPMN join chờ cả hai nhánh; story chỉ trình bày đường đi.',focus:['A_Split','A_Manager','A_Join']}
 ],
 timer:[
  {id:'normal',label:'01 · Phê duyệt bình thường',note:'Tác vụ hoàn tất theo luồng chính.',focus:['T_Start','T_Approve','T_End']},
  {id:'reminder',label:'02 · Nhắc sau 24 giờ',note:'Boundary Timer không ngắt tác vụ gốc. Chương bắt đầu ở sự kiện biên.',focus:['T_Timeout','T_Notify','T_Reminded']}
 ]
};
